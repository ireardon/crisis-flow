/*###################################
  #            REQUIRES             #
  ###################################*/

var bodyParser = require('body-parser');
var connect = require('connect');
var engines = require('consolidate');
var cookieParser = require('cookie-parser');
var cookie = require('cookie');
var crypto = require('crypto');
var ECT = require('ect');
var express = require('express');
var expressSession = require('express-session');
var http = require('http');
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

var ectEngine = ECT({ watch: true, root: __dirname + '/templates', ext: '.html' });

var server = http.createServer(app);
var io = socketIO(server);

app.engine('html', ectEngine.render); // tell Express to run .html files through ECT template parser
app.set('view engine', 'html');

app.set('views', __dirname + '/templates'); // tell Express where to find templates
app.use(express.static(__dirname));

app.use(cookieParser(config.COOKIE_SIGN_SECRET));
app.use(expressSession({
	name: config.COOKIE_SESSION_KEY,
	secret: config.COOKIE_SIGN_SECRET,
	store: sessionStore,
	saveUninitialized: false,
	resave: false
}));
app.use(bodyParser.urlencoded({ extended: true })); // definitely use this feature

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
	var room_ids = [];
	rows.forEach(function(row) {
		room_ids.push(row.id);
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
		console.log('ROOM JOINED');
		socket.join(roomID);
		socket.room = roomID;
		
		clientDirectory.addClient(socket.user, socket, roomID, []);
		
		console.log(socket.room);
		console.log(socket.user);
		
		broadcastMembership(socket);
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
		dbops.completeTask(task_id);
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
		response.json(roomID);
	});
});

// create a new task
app.post('/add_task/:roomID', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	if(!sessionValid(request.session)) {
		response.json({ 'error': 'Session is invalid' });
		return;
	}
	
	var room_id = request.params.roomID;
	var author = request.session.user.username;
	var high_priority = JSON.parse(request.body.high_priority);
	
	var submit_time = dbops.createTask(room_id, author, request.body.title, 
		false, high_priority, request.body.content);
	
	var task_data = {
		'task_title': request.body.title, 
		'task_author': author,
		'task_high_priority': high_priority,
		'task_content': request.body.content,
		'task_time': submit_time
	};
	
	io.sockets.in(room_id).emit('stc_add_task', task_data);
	
	response.json({ 'success': true });
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
	}
	
	dbops.createUser(request.body.username, request.body.hashed_password, role_access, function(username) {
		if(username !== request.body.username) {
			response.json({ 'error': 'Username is already in use' });
		} else {
			response.json({ 'success': true });
		}
	});
});

/*###################################
  #          PAGE HANDLERS          #
  ###################################*/

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
			dbops.getTasksForRoom(roomID, function(task_list) {
				var context = {
					'room_id': roomID,
					'room_name': roomName,
					'username': username,
					'message_list': message_list,
					'task_list': task_list
				};
				
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

// get the room index page
app.get('/index', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	console.log(request.session);
	if(!sessionValid(request.session)) {
		response.redirect('/signin');
		return;
	}
	
	dbops.getAllRooms(function(roomsList) {
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

function getSaltBits() {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

	var result = '';
	for (var i = 0; i < config.SALT_LENGTH; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));

	return result;
}

function broadcastMembership(socket) {
	// fetch all sockets in a room
	var clients = io.sockets.clients(socket.room);

	// pull the nicknames out of the socket objects using array.map(...)
	var nicknames = clients.map(function(s){
		return s.nickname;
	});
	
	socket.emit('membership_change', nicknames); // the socket that caused this wants the updated list too
	socket.broadcast.to(socket.room).emit('membership_change', nicknames); // everybody else
}