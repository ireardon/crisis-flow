// this module contains the functions for all database access
var sqlite3 = require('sqlite3').verbose();
var moment = require('moment');

var config = require('../config');

var dataConn = new sqlite3.Database(config.DATA_DB_FILENAME, sqlite3.OPEN_READWRITE);
var sessionConn = new sqlite3.Database(config.SESSION_DB_FILENAME, sqlite3.OPEN_READWRITE);

module.exports = {
	'createUser': createUser,
	'createRoom': createRoom,
	'createMessage': createMessage,
	'createTask': createTask,
	'getSessionRecord': getSessionRecord,
	'getUser': getUser,
	'getRoomName': getRoomName,
	'getAllRooms': getAllRooms,
	'getAllMostRecents': getAllMostRecents,
	'getMessagesForRoom': getMessagesForRoom,
	'getTasksForRoom': getTasksForRoom,
	'getMostRecentMessageTime': getMostRecentMessageTime,
	'completeTask': completeTask
};

/*###################################
  #       INSERTION FUNCTIONS       #
  ###################################*/

function createUser(username, password_hash, role) {
	var sql = 'INSERT INTO users(username, password_hash, role) VALUES($username, $password_hash, $role)';
	dataConn.run(sql, {
		$username: username, 
		$password_hash: password_hash, 
		$role: role
	}, 
	function(error) {
		console.error(error);
		console.log(result);
	});
	
	console.log(sql);
	
	return username;
}

function createRoom(roomName, callback) {
	var room_id = -1;
	
	var sql = 'INSERT INTO rooms(name) VALUES($room_name)';
	dataConn.run(sql, {$room_name: roomName}, function(error) {
		console.error(error);
		
		room_id = this.lastID;
		console.log('ADDED room ' + room_id + ' to database');
		
		if(validCallback(callback)) {
			callback(room_id);
		}
	});
}

function createMessage(room_id, author, replyTo, content) {
	var currTime = new Date().getTime() / 1000;
	
	if(!replyTo) { // to indicate that this is a top-level message, we use a negative number
		replyTo = -1;
	}
	
	var sql = 'INSERT INTO messages(room, author, reply, content, time) VALUES($room_id, $author, $replyTo, $content, $currTime)';
	dataConn.run(sql, {
		$room_id: room_id, 
		$author: author, 
		$replyTo: replyTo, 
		$content: content, 
		$currTime: currTime
	}, function() {
		console.log('ADDED message in ' + room_id + ' from ' + author + ' to database');
	});
	
	return currTime;
}

function createTask(room_id, author, title, completed, high_priority, content) {
	var currTime = new Date().getTime() / 1000;
	
	var sql = 'INSERT INTO tasks(room, author, title, completed, high_priority, content, time) VALUES($room_id, $author, $title, $completed, $high_priority, $content, $currTime)';
	dataConn.run(sql, {
		$room_id: room_id, 
		$author: author, 
		$title: title, 
		$completed: Number(completed), 
		$high_priority: Number(high_priority), 
		$content: content, 
		$currTime: currTime
	}, function() {
		console.log('ADDED task in ' + room_id + ' from ' + author + ' to database');
	});
	
	return currTime;
}

/*###################################
  #       RETRIEVAL FUNCTIONS       #
  ###################################*/

function getSessionRecord(sessionKey, callback) {
	var sql = 'SELECT * FROM sessions WHERE sid = $sessionKey';
	sessionConn.get(sql, {$sessionKey: sessionKey}, function(error, row) {
		if(error)
			console.error(error);
	
		if (validCallback(callback))
			callback(row);
	});
}
  
function getUser(username, callback) {
	var sql = 'SELECT * FROM users WHERE username = $username';
	dataConn.get(sql, {$username: username}, function(error, row) {
		if(error)
			console.error(error);
	
		if (validCallback(callback))
			callback(row);
	});
}

function getRoomName(room_id, callback) {
	var roomName = 'Unnamed room';

	var sql = 'SELECT name FROM rooms WHERE id = $room_id';
	dataConn.get(sql, {$room_id: room_id}, function(error, row) {
		if(error)
			console.error(error);
	
		if(row.name)
			roomName = row.name;
		
		if (validCallback(callback))
			callback(roomName);
	});
}

function getAllRooms(callback) {
	var roomsList = [];

	var sql = 'SELECT id, name FROM rooms';
	dataConn.all(sql, {}, function(error, rows) {
		if(error)
			console.error(error);
	
		if (validCallback(callback))
			callback(rows);
	});
	
	/*
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
	*/
}

// TODO: not currently in use
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

	var sql;
	if(limit) {
		sql = 'SELECT * FROM messages WHERE room = $room_id AND reply < 0 ORDER BY time ASC LIMIT $limit';
	} else {
		sql = 'SELECT * FROM messages WHERE room = $room_id AND reply < 0 ORDER BY time ASC';
	}
	
	dataConn.each(sql, {
		$room_id: room_id, 
		$limit: limit
	}, function(error, row) { // on-row callback
		messages_list.push(row);
		msg_ids_list.push(row.id);
	}, function(error, numrows) { // on-completion callback
		if(error)
			console.error(error);
	
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
	var sql = 'SELECT * FROM tasks WHERE room = $room_id AND completed = 0 ORDER BY time DESC';
	dataConn.all(sql, {$room_id: room_id}, function(error, rows) {
		if(error)
			console.error(error);
			
		if(validCallback(callback))
			callback(rows);
	});
}

// TODO: not currently used
function getMostRecentMessageTime(room_id, callback) {
	var sql = 'SELECT time FROM messages WHERE room = $1 ORDER BY time DESC LIMIT 1';
	var q = dataConn.query(sql, [room_id]);
	
	var mostRecent;
	
	q.on('row', function(row){
		mostRecent = row.time;
	});
	
	// call callback with result
	q.on('end', function() {
		if(mostRecent)
			mostRecent = moment.unix(mostRecent).fromNow();
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
			sql += '?';
		} else {
			sql += '?, ';
		}
	}
	sql += ') ORDER BY time ASC';
	
	console.log(sql);
	
	dataConn.each(sql, ids_list, 
	function(error, row) { // on-row callback
		replies_list.push(row);
		replies_ids_list.push(row.id);
	}, function(error, numrows) { // on-completion callback
		if(error)
			console.error(error);
		
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
  #         UPDATE FUNCTIONS        #
  ###################################*/

function completeTask(task_id, callback) {
	var sql = 'UPDATE tasks SET completed = 1 WHERE id = $task_id';
	
	dataConn.run(sql, {$task_id: task_id}, function() {
		console.log('TASK ' + task_id + ' set to completed');
	});
}

/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/

function validCallback(callback) {
	return callback && typeof(callback) === 'function';
}

function databaseCleanup() {
	dataConn.close();
	sessionConn.close();
}
