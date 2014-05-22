/*###################################
  #            REQUIRES             #
  ###################################*/

var http = require('http');
var connect = require('connect');
var express = require('express');
var anyDB = require('any-db');
var engines = require('consolidate');
var cookies = require('cookies');
var cookie = require('cookie');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var SocketIOSessions = require('session.socket.io');

var dbops = require('./database_ops');

/*###################################
  #          CONFIGURATION          #
  ###################################*/

var COOKIE_SIGN_SECRET = 'genericsecret';
var COOKIE_SESSION_KEY = 'crisis_flow_session';

var app = express();
var conn = anyDB.createConnection('sqlite3://chatroom.db');

var cookieParser = express.cookieParser(COOKIE_SIGN_SECRET);
var sessionStore = new connect.session.MemoryStore();

var server = http.createServer(app);

app.configure(function() {
	app.engine('html', engines.hogan); // tell Express to run .html files through Hogan
	app.set('views', __dirname + '/templates'); // tell Express where to find templates
	app.use(express.static(__dirname));
	
	app.use(cookieParser);
	app.use(express.session({
		key: COOKIE_SESSION_KEY,
		store: sessionStore
	}));
	app.use(express.bodyParser()); // definitely use this feature
});

var io = require('socket.io').listen(server);
var sessionSockets = new SocketIOSessions(io, sessionStore, cookieParser, COOKIE_SESSION_KEY);

server.listen(8080, function() {
	console.log("LISTENING on port 8080");
});

/*###################################
  #            SOCKET IO            #
  ###################################*/

sessionSockets.on('connection', function(error, socket, session) {
	console.log('SOCKET connected');
	console.log(error);
	console.log(socket);
	console.log(session);
	
	// check that this socket is associated with a valid session
	if(!sessionValid(session)) {
		socket.emit('error', "Session is invalid");
		socket.disconnect();
	}
	
	socket.on('join', function(roomID, nickname) {
		socket.join(roomID);
		socket.nickname = nickname;
		socket.room = roomID;
		
		broadcastMembership(socket);
	});

	// this gets emitted if a user changes their nickname
	socket.on('nickname', function(nickname) {
		socket.nickname = nickname;
		
		broadcastMembership(socket);
	});

	// the client emits this when they want to send a message
	socket.on('cts_message', function(message) {
		var submitTime = dbops.createMessage(conn, socket.room, socket.nickname, message);
		
		socket.broadcast.to(socket.room).emit('stc_message', socket.nickname, message, submitTime); //emit to 'room' except this socket
	});
	
	// the clients emits this when they want to send a "whisper" - a private message
	socket.on('cts_whisper', function(target, message) {
		var clients = io.sockets.clients(socket.room);
		var target_sock;
		for(var i=0; i<clients.length; i++) {
			if(clients[i].nickname === target) {
				target_sock = clients[i];
			}
		}
	
		if(!target_sock) {
			console.log('ERROR unable to find socket specified as whisper recipient');
			return;
		}
	
		target_sock.emit('stc_whisper', socket.nickname, message, (new Date().getTime() / 1000)); // emit only to intended recipient
	});
	
	// the client emits this whenever it types into the input field
	socket.on('cts_typing', function() {
		socket.broadcast.to(socket.room).emit('stc_typing', socket.nickname);
	});
	
	socket.on('cts_user_idle', function() {
		socket.broadcast.to(socket.room).emit('stc_user_idle', socket.nickname);
	});

	socket.on('cts_user_active', function() {
		socket.broadcast.to(socket.room).emit('stc_user_active', socket.nickname);
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

	var roomID = request.params.roomID;

	// fetch all of the messages for this room
	dbops.getMessagesForRoom(conn, roomID, function(messagesList) {
		// encode the messages object as JSON and send it back
		response.json(messagesList);
	});
});

// post a message in the given room
app.post('/rooms/:roomID/send_message', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	var roomID = request.params.roomID;
	var nickname = request.session.nickname;
	var message = request.body.message;
	
	var submitTime = dbops.createMessage(conn, roomID, nickname, message);
	response.json(submitTime);
});

// create a new room
app.post('/create_room', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	var roomName = request.body.room_name;
	var roomID = dbops.createRoom(conn, roomName);
	
	response.json(roomID);
});

// get the signin with given nickname
app.get('/signin/:nickname', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	var nickname = request.params.nickname;

	request.session.nickname = nickname; // to create a new nickname, replace the old
	
	response.json(nickname);
});

/*###################################
  #          PAGE HANDLERS          #
  ###################################*/

// get the page for the given room
app.get('/rooms/:roomID', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	var roomID = request.params.roomID;
	var nickname = request.session.nickname;
	dbops.getRoomName(conn, roomID, function(roomName) {
		dbops.getMessagesForRoom(conn, roomID, function(messagesList) {
			response.render('room.html', {
				'room_id': roomID,
				'room_name': roomName,
				'nickname': nickname,
				'message_temp': messagesList
			});
		});
	});
});

// get the room index page
app.get('/index', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);

	dbops.getAllRooms(conn, function(roomsList) {
		response.render('index.html', {
			'room_temp': roomsList
		});
	});
});

// get the signin page
app.get('/signin', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	response.render('signin.html', {});
});

// get the signin page if no cookie, index otherwise
app.get('/', function(request, response) {
	console.log(request.method + ' ' + request.originalUrl);
	
	var nickname = request.session.nickname; // if we don't have a nickname, make one
	if(!nickname) {
		response.render('signin.html', {});
	} else { // else go to the rooms index
		dbops.getAllRooms(conn, function(roomsList) {
			response.render('index.html', {
				'room_temp': roomsList
			});
		});
	}
});

/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/

function sessionValid(session) {
	if(!session) {
		return false;
	}
	
	return true;
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