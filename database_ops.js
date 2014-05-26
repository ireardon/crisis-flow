// this module contains the functions for all database access
var anyDB = require('any-db');
var humanize = require('humanize');

var settings = require('./settings');

var conn = anyDB.createConnection(settings.ANYDB_CONNECT_ID);

module.exports = {
	'createUser': createUser,
	'createRoom': createRoom,
	'createMessage': createMessage,
	'createTask': createTask,
	'getUser': getUser,
	'getRoomName': getRoomName,
	'getAllRooms': getAllRooms,
	'getAllMostRecents': getAllMostRecents,
	'getMessagesForRoom': getMessagesForRoom,
	'getMostRecentMessageTime': getMostRecentMessageTime
};

/*###################################
  #       INSERTION FUNCTIONS       #
  ###################################*/

function createUser(username, password_hash, role) {
	var sql = 'INSERT INTO users(username, password_hash, role) VALUES($1, $2, $3);';
	var q = conn.query(sql, [username, password_hash, role]);
	q.on('err', function(err) { // if this username is already in use, try again
		return null;
	});
	q.on('end', function() {
		console.log('ADDED user ' + username + ' to database');
	});
	
	return username;
}

function createRoom(roomName) {
	var roomID = generateRoomIdentifier();

	var sql = 'INSERT INTO rooms(id, name) VALUES($1, $2);';
	var q = conn.query(sql, [roomID, roomName]);
	q.on('err', function(err) { // if the room id is already in use, try again
		roomID = createRoom(roomName);
	});
	q.on('end', function() {
		console.log('ADDED room ' + roomID + ' to database');
	});
	
	return roomID;
}

function createMessage(roomID, author, replyTo, content) {
	var currTime = new Date().getTime() / 1000;
	var sql = 'INSERT INTO messages(room, author, reply, content, time) VALUES($1, $2, $3, $4, $5);';
	var q = conn.query(sql, [roomID, author, replyTo, content, currTime]);
	
	q.on('end', function() {
		console.log('ADDED message in ' + roomID + ' from ' + author + ' to database');
	});
	
	return currTime;
}

function createTask(roomID, author, title, completed, high_priority, content) {
	var currTime = new Date().getTime() / 1000;
	var sql = 'INSERT INTO tasks(room, author, title, completed, high_priority, content, time) VALUES($1, $2, $3, $4, $5, $6, $7);';
	var q = conn.query(sql, [roomID, author, title, Number(completed), Number(high_priority), content, currTime]);
	
	q.on('end', function() {
		console.log('ADDED task in ' + roomID + ' from ' + author + ' to database');
	});
	
	return currTime;
}

/*###################################
  #       RETRIEVAL FUNCTIONS       #
  ###################################*/

function getUser(username, callback) {
	var user;

	var sql = 'SELECT * FROM users WHERE username = $1;';
	var q = conn.query(sql, [username]);
	q.on('row', function(row) {
		user = row;
	});
	
	q.on('end', function() {
		if (validCallback(callback))
			callback(user);
	});
}

function getRoomName(roomID, callback) {
	var roomName = 'Unnamed room';

	var sql = 'SELECT name FROM rooms WHERE id = $1;';
	var q = conn.query(sql, [roomID]);
	q.on('row', function(row) {
		roomName = row.name;
	});
	
	// call callback with result
	q.on('end', function() {
		if (validCallback(callback))
			callback(roomName);
	});
}

function getAllRooms(callback) {
	var roomsList = [];

	var sql = 'SELECT id, name FROM rooms;';
	var q = conn.query(sql);
	q.on('row', function(row){
		var roomData = {
			'room_id': row.id,
			'room_name': row.name
		};
		roomsList.push(roomData);
	});
	
	// call callback with result
	q.on('end', function() {
		getAllMostRecents(roomsList, callback); // this only exists because
	});
}

function getAllMostRecents(roomsList, callback) {
	// javascript is a FUCKING STUPID language
	
	if (roomsList.length == 0) {
		if (validCallback(callback)) {
			callback(roomsList);
		}
		return;
	}
	
	var i = 0;
	var mostRecentCallback = function(lastPostTime) {
		roomsList[i]['last_post_time'] = lastPostTime;
		
		if(i < roomsList.length - 1) {
			i++;
			getMostRecentMessageTime(roomsList[i]['room_id'], mostRecentCallback);
		} else {
			if (validCallback(callback))
				callback(roomsList);
		}
	};
	
	getMostRecentMessageTime(roomsList[i]['room_id'], mostRecentCallback);
}

function getMessagesForRoom(roomID, callback) {
	var messagesList = [];

	var sql = 'SELECT * FROM messages WHERE room=$1 ORDER BY time ASC';
	var q = conn.query(sql, [roomID]);
	q.on('row', function(row){
		
		var messageData = {
			'msg_id': row.id,
			'msg_poster': row.nickname,
			'msg_text': row.content,
			'msg_time': row.time
		};
		messagesList.push(messageData);
	});
	
	// call callback with result
	q.on('end', function() {
		if (validCallback(callback))
			callback(messagesList);
	});
}

function getMostRecentMessageTime(roomID, callback) {
	var sql = 'SELECT time FROM messages WHERE room=$1 ORDER BY time DESC LIMIT 1';
	var q = conn.query(sql, [roomID]);
	
	var mostRecent;
	
	q.on('row', function(row){
		mostRecent = row.time;
	});
	
	// call callback with result
	q.on('end', function(result) {
		if(mostRecent)
			mostRecent = humanize.relativeTime(mostRecent);
		else
			mostRecent = 'None yet!';
		
		if (validCallback(callback))
			callback(mostRecent);
	});
}

/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/

function validCallback(callback) {
	return callback && typeof(callback) === 'function';
}

function generateRoomIdentifier() {
	// make a list of legal characters
	// we're intentionally excluding 0, O, I, and 1 for readability
	var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

	var result = '';
	for (var i = 0; i < settings.ROOM_ID_LENGTH; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));

	return result;
}