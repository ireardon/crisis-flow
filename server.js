/*###################################
  #            REQUIRES             #
  ###################################*/

var bodyParser = require('body-parser');
var connect = require('connect');
var engines = require('consolidate');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var ECT = require('ect');
var express = require('express');
var expressSession = require('express-session');
var fs = require('fs');
var http = require('http');
var mime = require('mime');
var multer = require('multer');
var path = require('path');
var socketIO = require('socket.io');
var SQLiteStore = require('connect-sqlite3')(expressSession);

global.__base = __dirname;
global.__localModules = path.join(__base, 'localModules');

var locals = require(__localModules);
var config = require(locals.config);
var dbops = require(locals.server.database.dbops);
var getcookie = require(locals.lib.getcookie);
var clientdir = require(locals.lib.ClientDirectory);
var report = require(locals.lib.report);
var security = require(locals.server.security);
var errorHandler = require(locals.server.error);

/*###################################
  #          CONFIGURATION          #
  ###################################*/

var port = process.env.PORT || 8080;
var app = express();

var sessionStore = new SQLiteStore({ table: config.SESSION_DB_TABLENAME });

var ectEngine = ECT({ watch: true, root: path.join(__dirname, 'client', 'templates'), ext: '.html' });

var server = http.createServer(app);
var io = socketIO(server);

app.engine('html', ectEngine.render); // tell Express to run .html files through ECT template parser
app.set('view engine', 'html');

app.set('views', path.join(__dirname, 'client', 'templates')); // tell Express where to find templates
app.use(express.static(path.join(__dirname, 'client')));

app.use(cookieParser(config.COOKIE_SIGN_SECRET));
app.use(expressSession({
	name: config.COOKIE_SESSION_KEY,
	secret: config.COOKIE_SIGN_SECRET,
	store: sessionStore,
	saveUninitialized: false,
	resave: false
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(multer({ dest: config.LOCAL_UPLOAD_PATH}));

var clientDirectory = io.sockets.clientDirectory = new clientdir.ClientDirectory();
clientDirectory.syncToDB(function() {
	server.listen(port, function() {
		console.log("LISTENING on port " + port);
	});
});

var page = require(locals.server.routes.page)(clientDirectory);
var ajax = require(locals.server.routes.ajax)(clientDirectory);

/*###################################
  #            SOCKET IO            #
  ###################################*/

io.use(function(socket, next) {
	var sessionId = getcookie.getcookie(socket.request, config.COOKIE_SESSION_KEY, config.COOKIE_SIGN_SECRET);

	sessionStore.get(sessionId, function(storeError, session) {
		if (!session) {
			next(new Error("Not authorized"));
		}

		socket.session = session;
		next();
	});
});

io.sockets.on('connection', function(socket) {
	report.debug('SOCKET connected');

	socket.emit('stc_rejoin');

	// check that this socket is associated with a valid session
	if(!security.sessionValid(socket.session)) {
		socket.emit('recoverableError', "Session is invalid");
		socket.disconnect();
		return;
	}

	socket.user = socket.session.user.username;

	socket.on('join', function(roomID) {
		report.debug('ROOM JOINED');
		socket.join(roomID);
		socket.room = roomID;

		clientDirectory.addClient(socket.user, socket, roomID);

		var clientIdentifiers = clientDirectory.getClientsByRoom(socket.room);

		dbops.getUsersDictionary(function(error, usersDictionary) {
			if(error) {
				socket.emit('recoverableError', "Failed to join");
				return;
			}

			var clients = clientIdentifiers.map(function(userID) {
				return usersDictionary[userID];
			});

			socket.broadcast.to(socket.room).emit('membership_change', clients);
		});
	});

	// the client emits this when they want to send a message
	socket.on('cts_message', function(message) {
		report.debug('MESSAGE RECEIVED');
		dbops.createMessage(socket.room, socket.user, message.reply, message.content, function(error, messageID, submitTime) {
			if(error) {
				socket.emit('recoverableError', "Message failed to send.");
				return;
			}

			message.id = messageID;
			message.room = socket.room;
			message.author = socket.user;
			message.authorDisplayName = socket.session.user.display_name;
			message.time = submitTime;

			socket.emit('stc_message', message);
			socket.broadcast.to(socket.room).emit('stc_message', message); //emit to 'room' except this socket
		});
	});

	// the client emits this whenever the user marks a task as completed
	socket.on('cts_task_status_changed', function(taskID, oldStatus, newStatus) {
		report.debug('RECEIVED task status change');

		oldStatus = Number(oldStatus);
		newStatus = Number(newStatus);

		if(!validStatus(oldStatus) || !validStatus(newStatus)) {
			report.error('ERROR invalid task status change');
		}

		dbops.updateTaskStatus(taskID, oldStatus, newStatus, function(error) {
			if(error) {
				socket.emit('recoverableError', "Failed to update task status.");
				return;
			}

			socket.broadcast.to(socket.room).emit('stc_task_status_changed', taskID, newStatus);
		});
	});

	socket.on('cts_followup_task', function(followup) {
		dbops.createTaskFollowup(followup.task, followup.content, followup.author, function(error, taskFollowupID, submitTime) {
			if(error) {
				socket.emit('recoverableError', "Failed to create a task followup.");
				return;
			}

			var taskFollowupData = {
				'id': taskFollowupID,
				'author': followup.author,
				'task': followup.task,
				'content': followup.content,
				'time': submitTime
			};

			io.sockets.in(socket.room).emit('stc_followup_task', taskFollowupData);
		});
	});

	// the client emits this whenever it types into the input field
	socket.on('cts_typing', function() {
		socket.broadcast.to(socket.room).emit('stc_typing', socket.user);
	});

	socket.on('cts_user_idle', function() {
		socket.broadcast.to(socket.room).emit('stc_user_idle', socket.user);
	});

	socket.on('cts_user_active', function() {
		socket.broadcast.to(socket.room).emit('stc_user_active', socket.user);
	});

	socket.on('cts_join_channel', function(channelID) {
		clientDirectory.addToChannel(socket.user, socket.room, channelID);
	});

	socket.on('cts_leave_channel', function(channelID) {
		clientDirectory.removeFromChannel(socket.user, socket.room, channelID);
	});

	// the client disconnected/closed their browser window
	socket.on('disconnect', function() {
		report.debug('SOCKET disconnected');

		var roomID = socket.room;
		// the docs say there is no need to call socket.leave(), as it happens automatically
		// but this is clearly a lie, because it doesn't work
		// fetch all sockets in a room

		if(roomID !== undefined) { // if the server has gone down and no reconnect occurred, this will not exist
			socket.leave(roomID);
			clientDirectory.removeClient(socket.user, roomID);

			var remainingUsersIdentifiers = clientDirectory.getClientsByRoom(roomID);

			dbops.getUsersDictionary(function(error, usersDictionary) {
				if(error) {
					socket.emit('recoverableError', "Leave failed");
					return;
				}

				var remainingUsers = remainingUsersIdentifiers.map(function(userID) {
					return usersDictionary[userID];
				});

				io.sockets.in(roomID).emit('membership_change', remainingUsers);
			});
		}
	});
});

/*###################################
  #          AJAX HANDLERS          #
  ###################################*/

// get updated json of the messages for a given room
app.get('/rooms/:roomID/data.json', ajax.get.dataJSON);

// get updated json of the messages for a given room
app.get('/rooms/:roomID/archive/messages.json', ajax.get.messageJSON);

// get updated json of the messages for a given room
app.get('/rooms/:roomID/archive/tasks.json', ajax.get.taskJSON);

app.get('/tags.json', ajax.get.tagJSON);

// post a message in the given room
app.post('/rooms/:roomID/send_message', ajax.post.sendMessage);

// create a new room
app.post('/create_room', ajax.post.createRoom);

// delete a room
app.post('/delete_room', ajax.post.deleteRoom);

// rename a room
app.post('/rename_room', ajax.post.renameRoom);

app.post('/create_channel', ajax.post.createChannel);

app.post('/delete_channel', ajax.post.deleteChannel);

app.post('/rename_channel', ajax.post.renameChannel);

// create a new task
app.post('/add_task/:roomID', ajax.post.addTask);

// signin with given username and password
app.post('/signin', ajax.post.signin);

app.post('/signup', ajax.post.signup);

/*###################################
  #          PAGE HANDLERS          #
  ###################################*/

app.get('/uploads/:filepath', page.get.uploadedFile);

// get the page for the given room
app.get('/rooms/:roomID', page.get.room);

// get the message archive page for the given room
app.get('/rooms/:roomID/archive/messages', page.get.messageArchive);

// get the task adding page
app.get('/add_task/:roomID', page.get.addTask);

app.get('/manage_rooms', page.get.manageRooms);

// get the room index page
app.get('/index', page.get.index);

// get the signup page
app.get('/signup', page.get.signup);

// get the signin page
app.get('/signin', page.get.signin);

// mark session inactive and redirect to signin
app.get('/signout', page.get.signout);

// get the signin page if no active session, index otherwise
app.get('/', function(request, response) {
	errorHandler.reportRequest(request);

	if(!security.sessionValid(request.session)) {
		response.redirect('/signin');
	} else { // else go to the rooms index
		response.redirect('/index');
	}
});

/*###################################
  #    ERROR-HANDLING MIDDLEWARE    #
  ###################################*/

app.use(errorHandler.send404);
app.use(errorHandler.send500);
