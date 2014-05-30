/*###################################
  #            REQUIRES             #
  ###################################*/

var http = require('http');
var connect = require('connect');
var express = require('express');
var engines = require('consolidate');
var cookies = require('cookies');
var cookie = require('cookie');
var crypto = require('crypto');
var SocketIOSessions = require('session.socket.io');

var settings = require('./settings');
var dbops = require('./database_ops');

/*###################################
  #          CONFIGURATION          #
  ###################################*/

var app = express();

var cookieParser = express.cookieParser(settings.COOKIE_SIGN_SECRET);
var sessionStore = new connect.session.MemoryStore();

var server = http.createServer(app);

app.configure(function() {
	app.engine('html', engines.hogan); // tell Express to run .html files through Hogan
	app.set('views', __dirname + '/templates'); // tell Express where to find templates
	app.use(express.static(__dirname));
	
	app.use(cookieParser);
	app.use(express.session({
		key: settings.COOKIE_SESSION_KEY,
		store: sessionStore
	}));
	app.use(express.bodyParser()); // definitely use this feature
});

var io = require('socket.io').listen(server);
var sessionSockets = new SocketIOSessions(io, sessionStore, cookieParser, settings.COOKIE_SESSION_KEY);

server.listen(8080, function() {
	console.log("LISTENING on port 8080");
});

/*###################################
  #            SOCKET IO            #
  ###################################*/

sessionSockets.on('connection', function(error, socket, session) {
	console.log('SOCKET connected');
	console.log(session);
	
	// check that this socket is associated with a valid session
	if(!sessionValid(session)) {
		socket.emit('error', "Session is invalid");
		socket.disconnect();
	}
	
	socket.user = session.user.username;
	
	socket.on('join', function(roomID) {
		socket.join(roomID);
		socket.room = roomID;
		
		console.log(socket.room);
		console.log(socket.user);
		
		broadcastMembership(socket);
	});

	// the client emits this when they want to send a message
	socket.on('cts_message', function(data) {
		var submit_time = dbops.createMessage(socket.room, socket.user, data.msg_reply_to, data.msg_content);
		
		data.msg_author = socket.user;
		data.msg_time = submit_time;
		
		socket.broadcast.to(socket.room).emit('stc_message', data); //emit to 'room' except this socket
	});
	
	// the clients emits this when they want to send a "whisper" - a private message
	socket.on('cts_whisper', function(target, message) {
		var clients = io.sockets.clients(socket.room);
		var target_sock;
		for(var i=0; i<clients.length; i++) {
			if(clients[i].username === target) {
				target_sock = clients[i];
			}
		}
	
		if(!target_sock) {
			console.log('ERROR unable to find socket specified as whisper recipient');
			return;
		}
	
		target_sock.emit('stc_whisper', socket.username, message, (new Date().getTime() / 1000)); // emit only to intended recipient
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
		
		var clients = io.sockets.clients(roomID);
		// pull the nicknames out of the socket objects using array.map(...)
		var nicknames = clients.map(function(s) {
			return s.nickname;
		});
		
		io.sockets.in(roomID).emit('membership_change', nicknames);
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
	dbops.getMessagesForRoom(roomID, settings.DEFAULT_MESSAGE_COUNT, function(messagesList) {
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
	var roomID = dbops.createRoom(roomName);
	
	response.json(roomID);
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
		if(!user) {
			response.json({ 'error': 'No such user' });
			return;
		}
	
		request.session.user = user;
		
		var valid_password = verifyPasswordHash(user, request.body.client_salted_hash, request.body.client_salt, request.session.server_salt);
		console.log(valid_password);
		
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
		dbops.getMessagesForRoom(roomID, settings.DEFAULT_MESSAGE_COUNT, function(message_list) {
			dbops.getTasksForRoom(roomID, function(task_list) {
				var context = {
					'room_id': roomID,
					'room_name': roomName,
					'username': username,
					'message_list': message_list,
					'task_list': task_list
				};
				
				response.render('room_producer.html', context);
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

	if(!sessionValid(request.session)) {
		response.redirect('/signin');
		return;
	}
	
	dbops.getAllRooms(function(roomsList) {
		var context = {
			'room_temp': roomsList
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
		console.log(i);
		console.log(role_code_salted_hash);
		
		if(access_code_salted_hash === role_code_salted_hash) {
			return i + 1;
		}
	}
	
	return 0;
}

function getSaltBits() {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

	var result = '';
	for (var i = 0; i < settings.SALT_LENGTH; i++)
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