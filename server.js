/*###################################
  #            REQUIRES             #
  ###################################*/

var bodyParser = require('body-parser');
var connect = require('connect');
var engines = require('consolidate');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var crypto = require('crypto');
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

var config = require('./config');
var dbops = require('./lib/database_ops');
var getcookie = require('./lib/getcookie');
var clientdir = require('./lib/ClientDirectory');

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
app.use(multer({ dest: './uploads/'}));

server.listen(port, function() {
	console.log("LISTENING on port 8080");
});

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

var clientDirectory = io.sockets.clientDirectory = new clientdir.ClientDirectory();
// this bit is super race-conditiony: this is an async call which
// does not necessarily finish before the server starts listening for stuff
// basically rests on the assumption that people won't be trying to join 
// rooms immediately after the server starts up
dbops.getAllRooms(function (rows) {
	var room_ids = rows.map(function(row) {
		return row.id;
	});
	clientDirectory.addRooms(room_ids);
});

io.sockets.on('connection', function(socket) {
	console.log('SOCKET connected');
	
	// check that this socket is associated with a valid session
	if(!sessionValid(socket.session)) {
		socket.emit('error', "Session is invalid");
		socket.disconnect();
	}
	
	socket.user = socket.session.user.username;
	
	socket.on('join', function(roomID) {
		console.error('ROOM JOINED');
		socket.join(roomID);
		socket.room = roomID;
		
		clientDirectory.addClient(socket.user, socket, roomID, []);
		
		console.error(socket.room);
		console.error(socket.user);
		
		setTimeout(function() { broadcastMembership(socket); }, 2000);
	});

	// the client emits this when they want to send a message
	socket.on('cts_message', function(data) {
		console.log('MESSAGE RECEIVED');
		var submit_time = dbops.createMessage(socket.room, socket.user, data.msg_reply_to, data.msg_content);
		
		data.msg_author = socket.user;
		data.msg_time = submit_time;
		
		socket.broadcast.to(socket.room).emit('stc_message', data); //emit to 'room' except this socket
	});
	
	// the clients emits this when they want to send a "whisper" - a private message
	socket.on('cts_whisper', function(target, message) {
		var target_sock = clientDirectory.getSocket(target);
	
		if(!target_sock) {
			console.log('ERROR unable to find socket specified as whisper recipient');
			return;
		}
	
		target_sock.emit('stc_whisper', socket.username, message, (new Date().getTime() / 1000)); // emit only to intended recipient
	});
	
	// the client emits this whenever the user marks a task as completed
	socket.on('cts_task_completed', function(task_id) {
		console.log('RECEIVED task completed');
		dbops.updateTaskStatus(task_id, config.STATUS_COMPLETED);
		socket.broadcast.to(socket.room).emit('stc_task_completed', task_id);
	});
	
	// the client emits this whenever it types into the input field
	socket.on('cts_typing', function() {
		socket.broadcast.to(socket.room).emit('stc_typing', socket.username);
	});
	
	socket.on('cts_user_idle', function() {
		socket.broadcast.to(socket.room).emit('stc_user_idle', socket.username);
	});

	socket.on('cts_user_active', function() {
		socket.broadcast.to(socket.room).emit('stc_user_active', socket.username);
	});
	
	// the client disconnected/closed their browser window
	socket.on('disconnect', function() {
		console.log('SOCKET disconnected');
		
		var roomID = socket.room;
		// the docs say there is no need to call socket.leave(), as it happens automatically
		// but this is clearly a lie, because it doesn't work
		// fetch all sockets in a room
		socket.leave(roomID);
		clientDirectory.removeClient(socket.user, roomID);
		
		var remainingUsers = clientDirectory.getClientsByRoom(roomID);
		
		io.sockets.in(roomID).emit('membership_change', remainingUsers);
	});
});

/*###################################
  #          AJAX HANDLERS          #
  ###################################*/

// get updated json of the messages for a given room
app.get('/rooms/:roomID/messages.json', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	if(!sessionValid(request.session)) {
		response.json({ 'error': 'Session is invalid' });
		return;
	}

	var roomID = request.params.roomID;

	// fetch all of the messages for this room
	dbops.getMessagesForRoom(roomID, config.DEFAULT_MESSAGE_COUNT, function(messagesList) {
		// encode the messages object as JSON and send it back
		response.json(messagesList);
	});
});

// post a message in the given room
app.post('/rooms/:roomID/send_message', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	if(!sessionValid(request.session)) {
		response.json({ 'error': 'Session is invalid' });
		return;
	}
	
	var roomID = request.params.roomID;
	var username = request.session.user.username;
	var message = request.body.message;
	
	var submit_time = dbops.createMessage(roomID, username, message);
	response.json(submit_time);
});

// create a new room
app.post('/create_room', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	if(!sessionValid(request.session)) {
		response.json({ 'error': 'Session is invalid' });
		return;
	}
	
	var roomName = request.body.room_name;
	dbops.createRoom(roomName, function(roomID) {
		clientDirectory.addRooms([roomID]);
		response.json(roomID);
	});
});

// delete a room
app.post('/delete_room', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	if(!sessionValid(request.session)) {
		response.json({ 'error': 'Session is invalid' });
		return;
	}
	
	var roomID = request.body.room_id;
	clientDirectory.removeRooms([roomID]);
	dbops.deleteRoom(roomID, function() {
		response.json(roomID);
	});
});

// rename a room
app.post('/rename_room', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	if(!sessionValid(request.session)) {
		response.json({ 'error': 'Session is invalid' });
		return;
	}
	
	dbops.renameRoom(request.body.room_id, request.body.new_name, function() {
		response.json(request.body.room_id);
	});
});

// create a new task
app.post('/add_task/:roomID', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	if(!sessionValid(request.session)) {
		response.json({ 'error': 'Session is invalid' });
		return;
	}
	
	console.log(request.files);
	console.log(request.body);
	var room_id = request.params.roomID;
	var author = request.session.user.username;
	var highPriority = Boolean(request.body.high_priority);
	
	var files = Object.keys(request.files).map(function(key) {
		return request.files[key];
	});
	
	dbops.createTask(room_id, author, request.body.title, highPriority, request.body.content, function(taskID, submitTime) {
		attachFilesToTask(taskID, files, function() {
			var taskData = {
				'task_title': request.body.title, 
				'task_author': author,
				'task_high_priority': highPriority,
				'task_content': request.body.content,
				'task_time': submitTime
			};
			
			io.sockets.in(room_id).emit('stc_add_task', taskData);
			
			response.redirect('/rooms/' + room_id);
		});
	});
});

// signin with given username and password
app.post('/signin', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	var username = request.body.username;

	console.log(username);
	
	dbops.getUser(username, function(user) {
		console.log('got user');
		if(!user) {
			response.json({ 'error': 'No such user' });
			return;
		}
	
		request.session.user = user;
		
		var valid_password = verifyPasswordHash(user, request.body.client_salted_hash, request.body.client_salt, request.session.server_salt);
		
		if(valid_password) {
			delete request.session.server_salt;
			request.session.active = true;
			
			response.json({ 'success': true });
		} else {
			response.json({ 'error': 'Password is incorrect' });
		}
	});
});

app.post('/signup', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	var role_access = getAccessRole(request.body.access_code_salted_hash, request.body.client_salt, request.session.server_salt);
	console.log("Role access: " + role_access);
	
	if(!role_access) {
		response.json({ 'error': 'Access code is incorrect' });
	} else {
		dbops.createUser(request.body.username, request.body.hashed_password, role_access, function(error) {
			if(error) {
				response.json({ 'error': 'Username is already in use' });
			} else {
				response.json({ 'success': true });
			}
		});
	}
});

/*###################################
  #          PAGE HANDLERS          #
  ###################################*/

app.get('/uploads/:filepath', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	if(!sessionValid(request.session)) {
		response.redirect('/signin');
		return;
	}
	
	var filename = path.basename(request.params.filepath);
	var mimetype = mime.lookup(filename);
	
	dbops.getAttachmentByFilename(filename, function(userFilename) {
		response.setHeader('Content-disposition', 'attachment; filename=' + userFilename);
		response.setHeader('Content-type', mimetype);

		var filestream = fs.createReadStream(path.join(__dirname, request.originalUrl));
		filestream.pipe(response);
	});
});
  
// get the page for the given room
app.get('/rooms/:roomID', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	if(!sessionValid(request.session)) {
		response.redirect('/signin');
		return;
	}
	
	var roomID = request.params.roomID;
	var username = request.session.user.username;
	dbops.getRoomName(roomID, function(roomName) {
		dbops.getMessagesForRoom(roomID, config.DEFAULT_MESSAGE_COUNT, function(message_list) {
			dbops.getOpenTasksForRoom(roomID, function(task_list) {
				var context = {
					'room_id': roomID,
					'room_name': roomName,
					'username': username,
					'message_list': message_list,
					'task_list': task_list,
					'upload_path': config.UPLOAD_PATH
				};
				
				
				console.log(context);
				response.render('room.html', context);
			});
		});
	});
});

// get the task adding page
app.get('/add_task/:roomID', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	if(!sessionValid(request.session)) {
		response.redirect('/signin');
		return;
	}
	
	var context = {
		'room_id': request.params.roomID
	};
	response.render('add_task.html', context);
});

app.get('/manage_rooms', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	if(!sessionValid(request.session)) {
		response.redirect('/signin');
		return;
	}
	
	dbops.getAllRooms(function(roomsList) {
		var context = {
			'room_list': roomsList
		};
		response.render('manage_rooms.html', context);
	});
});

// get the room index page
app.get('/index', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	console.log(request.session);
	if(!sessionValid(request.session)) {
		response.redirect('/signin');
		return;
	}
	
	dbops.getAllRooms(function(roomsList) {
		roomsList.forEach(function(room) {
			var members = clientDirectory.getClientsByRoom(room.id);
			room.num_members = members.length;
		});
	
		var context = {
			'room_list': roomsList
		};
		response.render('index.html', context);
	});
});

// get the signup page
app.get('/signup', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	request.session.server_salt = getSaltBits();
	
	var context = {
		'server_salt': request.session.server_salt
	};
	response.render('signup.html', context);
});

// get the signin page
app.get('/signin', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	request.session.server_salt = getSaltBits();
	
	var context = {
		'server_salt': request.session.server_salt
	};
	response.render('signin.html', context);
});

// mark session inactive and redirect to signin
app.get('/signout', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	request.session.active = false;
	
	response.redirect('/signin');
});

// get the signin page if no active session, index otherwise
app.get('/', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	if(!sessionValid(request.session)) {
		response.redirect('/signin');
	} else { // else go to the rooms index
		response.redirect('/index');
	}
});

/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/

function sessionValid(session) {
	if(!session || !session.active) {
		return false;
	}
	
	return true;
}

function verifyPasswordHash(user, client_salted_hash, client_salt, server_salt) {
	var key = user.password_hash + client_salt + server_salt;
	var server_salted_hash = crypto.createHash('sha256').update(key).digest('hex');
	
	return client_salted_hash === server_salted_hash;
}

function getAccessRole(access_code_salted_hash, client_salt, server_salt) {
	var access_roles = ['admin', 'producer', 'consumer'];
	
	console.log(access_code_salted_hash);
	for(var i=0; i<access_roles.length; i++) {
		var key = access_roles[i] + client_salt + server_salt;
		var role_code_salted_hash = crypto.createHash('sha256').update(key).digest('hex');
		
		if(access_code_salted_hash === role_code_salted_hash) {
			return i + 1;
		}
	}
	
	return 0;
}

function attachFilesToTask(task, files, callback) {
	if(files.length === 0) {
		callback();
	} else {
		var file = files.pop();
		
		dbops.createAttachment(file, function(attachmentID) {
			dbops.createTaskAttachment(task, attachmentID, function() {
				attachFilesToTask(task, files, callback);
			});
		});
	}
}

function getSaltBits() {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

	var result = '';
	for (var i = 0; i < config.SALT_LENGTH; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));

	return result;
}

function broadcastMembership(socket) {
	// fetch all sockets in a room
	var clients = clientDirectory.getClientsByRoom(socket.room);

	// pull the userIDs out of the socket objects using array.map(...)
	var usernames = clients.map(function(c) {
		return c.username;
	});
	
	//socket.emit('membership_change', usernames); // the socket that caused this wants the updated list too
	//socket.broadcast.to(socket.room).emit('membership_change', usernames); // everybody else
}