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
	'getTasksForRoom': getTasksForRoom,
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
	var room_id = generateroom_identifier();

	var sql = 'INSERT INTO rooms(id, name) VALUES($1, $2);';
	var q = conn.query(sql, [room_id, roomName]);
	q.on('err', function(err) { // if the room id is already in use, try again
		room_id = createRoom(roomName);
	});
	q.on('end', function() {
		console.log('ADDED room ' + room_id + ' to database');
	});
	
	return room_id;
}

function createMessage(room_id, author, replyTo, content) {
	var currTime = new Date().getTime() / 1000;
	
	if(!replyTo) { // to indicate that this is a top-level message, we use a negative number
		replyTo = -1;
	}
	
	var sql = 'INSERT INTO messages(room, author, reply, content, time) VALUES($1, $2, $3, $4, $5);';
	var q = conn.query(sql, [room_id, author, replyTo, content, currTime]);
	
	q.on('end', function() {
		console.log('ADDED message in ' + room_id + ' from ' + author + ' to database');
	});
	
	return currTime;
}

function createTask(room_id, author, title, completed, high_priority, content) {
	var currTime = new Date().getTime() / 1000;
	var sql = 'INSERT INTO tasks(room, author, title, completed, high_priority, content, time) VALUES($1, $2, $3, $4, $5, $6, $7);';
	var q = conn.query(sql, [room_id, author, title, Number(completed), Number(high_priority), content, currTime]);
	
	q.on('end', function() {
		console.log('ADDED task in ' + room_id + ' from ' + author + ' to database');
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

function getRoomName(room_id, callback) {
	var roomName = 'Unnamed room';

	var sql = 'SELECT name FROM rooms WHERE id = $1;';
	var q = conn.query(sql, [room_id]);
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

function getMessagesForRoom(room_id, limit, callback) {
	var messages_list = [];
	var msg_ids_list = [];

	var sql, q;
	if(limit) {
		sql = 'SELECT * FROM messages WHERE room=$1 AND reply < 0 ORDER BY time ASC LIMIT $2';
		q = conn.query(sql, [room_id, limit]);
	} else {
		sql = 'SELECT * FROM messages WHERE room=$1 AND reply < 0 ORDER BY time ASC';
		q = conn.query(sql, [room_id]);
	}
	
	q.on('row', function(row){
		messages_list.push(row);
		msg_ids_list.push(row.id);
	});
	
	// call callback with result
	q.on('end', function() {
		if(msg_ids_list.length === 0) { // no replies are possible
			if (validCallback(callback))
				callback(messages_list);
		} else { // we need to gather replies to the top-level messages we've collected
			getReplies(messages_list, msg_ids_list, function() {
				if (validCallback(callback))
					callback(messages_list);
			});
		}
	});
}

function getTasksForRoom(room_id, callback) {
	var tasks_list = [];

	var sql = 'SELECT * FROM tasks WHERE room=$1 AND completed = 0 ORDER BY time DESC';
	var q = conn.query(sql, [room_id]);
	
	q.on('row', function(row) {
		tasks_list.push(row);
	});
	
	q.on('end', function(result) {
		if (validCallback(callback))
			callback(tasks_list);
	});
}

function getMostRecentMessageTime(room_id, callback) {
	var sql = 'SELECT time FROM messages WHERE room=$1 ORDER BY time DESC LIMIT 1';
	var q = conn.query(sql, [room_id]);
	
	var mostRecent;
	
	q.on('row', function(row){
		mostRecent = row.time;
	});
	
	// call callback with result
	q.on('end', function() {
		if(mostRecent)
			mostRecent = humanize.relativeTime(mostRecent);
		else
			mostRecent = 'None yet!';
		
		if (validCallback(callback))
			callback(mostRecent);
	});
}

function getReplies(aggregated_messages_list, ids_list, callback) {
	var replies_list = [];
	var replies_ids_list = [];
	var sql = 'SELECT * FROM messages WHERE reply IN (';
	for(var i=0; i<ids_list.length; i++) {
		if(i === ids_list.length-1) {
			sql += '$' + (i+1);
		} else {
			sql += '$' + (i+1) + ', ';
		}
	}
	sql += ') ORDER BY time ASC';
	console.log(sql);
	var q = conn.query(sql, ids_list);
	
	q.on('row', function(row) {
		replies_list.push(row);
		replies_ids_list.push(row.id);
	});

	q.on('end', function() {
		if(replies_list.length === 0) { // replies list is empty so we can proceed with the callback
			if (validCallback(callback))
				callback();
		} else { // replies list has entries, which may themselves have replies
			aggregated_messages_list.concat(replies_list);
			getReplies(aggregated_messages_list, replies_ids_list, callback);
		}
	});
}

/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/

function validCallback(callback) {
	return callback && typeof(callback) === 'function';
}

function generateroom_identifier() {
	// make a list of legal characters
	// we're intentionally excluding 0, O, I, and 1 for readability
	var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

	var result = '';
	for (var i = 0; i < settings.ROOM_ID_LENGTH; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));

	return result;
}