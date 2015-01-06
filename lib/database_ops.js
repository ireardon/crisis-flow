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
	'createAttachment': createAttachment,
	'createTaskAttachment': createTaskAttachment,
	'createTag': createTag,
	'createChannel': createChannel,
	'getSessionRecord': getSessionRecord,
	'getUser': getUser,
	'getRoomName': getRoomName,
	'getAllRooms': getAllRooms,
	'getMessagesForRoom': getMessagesForRoom,
	'getOpenTasksForRoom': getOpenTasksForRoom,
	'updateTaskStatus': updateTaskStatus,
	'renameRoom': renameRoom,
	'deleteRoom': deleteRoom
};

/*###################################
  #       INSERTION FUNCTIONS       #
  ###################################*/

function createUser(username, password_hash, role, callback) {
	var sql = 'INSERT INTO users(username, password_hash, role) VALUES($username, $password_hash, $role)';
	console.log(sql);
	
	dataConn.run(sql, {
		$username: username, 
		$password_hash: password_hash, 
		$role: role
	}, 
	function(error) {
		if(error) {
			console.error(error);
		}
			
		if(validCallback(callback)) {
			callback(error);
		}
	});
}

function createRoom(roomName, callback) {
	var room_id = -1;
	
	var sql = 'INSERT INTO rooms(name) VALUES($room_name)';
	dataConn.run(sql, {$room_name: roomName}, function(error) {
		if(error)
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
	}, function(error) {
		if(error)
			console.error(error);
	
		console.log('ADDED message in ' + room_id + ' from ' + author + ' to database');
	});
	
	return currTime;
}

function createTask(room_id, author, title, high_priority, content, callback) {
	var currTime = new Date().getTime() / 1000;
	
	var sql = 'INSERT INTO tasks(room, author, title, status, high_priority, content, time) VALUES($room_id, $author, $title, $status, $high_priority, $content, $currTime)';
	dataConn.run(sql, {
		$room_id: room_id, 
		$author: author, 
		$title: title, 
		$status: config.STATUS_SUBMITTED, 
		$high_priority: Number(high_priority), 
		$content: content, 
		$currTime: currTime
	}, function(error) {
		if(error) {
			console.error(error);
		}
	
		console.log('ADDED task in ' + room_id + ' from ' + author + ' to database');
		
		if(validCallback(callback)) {
			callback(this.lastID, currTime);
		}
	});
}

function createAttachment(file, callback) {
	var sql = 'INSERT INTO attachments(user_filename, internal_filename) VALUES($user, $internal)';
	dataConn.run(sql, {
		$user: file.originalname,
		$internal: file.name
	}, function(error) {
		if(error)
			console.error(error);
			
		if(validCallback(callback)) {
			callback(this.lastID);
		}
	});
}

function createTaskAttachment(taskID, attachmentID, callback) {
	var sql = 'INSERT INTO task_attachments(task, attachment) VALUES($task, $attachment)';
	dataConn.run(sql, {
		$task: taskID,
		$attachment: attachmentID
	}, function(error) {
		if(error)
			console.error(error);
			
		if(validCallback(callback)) {
			callback();
		}
	});
}

function createTag(name, description) {
	var sql = 'INSERT INTO tags(name, description) VALUES($name, $description)';
	dataConn.run(sql, {
		$name: name,
		$description: description
	}, function(error) {
		if(error) {
			console.error(error);
		}
	});
}

function createChannel(room_id, name) {
	var sql = 'SELECT COUNT(*) AS channel_count FROM channels WHERE room = $room';
	dataConn.get(sql, {$room: room_id}, function(error, row) {
		if(error) {
			console.error(error);
		}
		
		console.log(row);
		
		sql = 'INSERT INTO channels(room, name, color_index) VALUES($room, $name, $color_index)';
		dataConn.run(sql, {
			$room: room_id,
			$name: name,
			$color_index: row.channel_count
		}, function(error) {
			if(error) {
				console.error(error);
			}
		});
	});
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
	var sql = 'SELECT * FROM rooms ORDER BY name ASC';
	dataConn.all(sql, {}, function(error, rows) {
		if(error)
			console.error(error);
	
		if (validCallback(callback))
			callback(rows);
	});
}

function getAllTags(callback) {
	var sql = 'SELECT * FROM tags ORDER BY name ASC';
	dataConn.all(sql, {}, function(error, rows) {
		if(error)
			console.error(error);
	
		if (validCallback(callback))
			callback(rows);
	});
}

function getChannelsForRoom(room_id, callback) {
	var sql = 'SELECT * FROM channels WHERE room = $room_id ORDER BY name ASC';
	dataConn.all(sql, {$room_id: room_id}, function(error, rows) {
		if(error)
			console.error(error);
			
		if(validCallback(callback))
			callback(rows);
	});
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

function getOpenTasksForRoom(room_id, callback) {
	var sql = 'SELECT * FROM tasks WHERE room = $room_id AND status != $completed ORDER BY time DESC';
	dataConn.all(sql, {
		$room_id: room_id,
		$completed: config.STATUS_COMPLETED
	}, function(error, rows) {
		if(error)
			console.error(error);
			
		getAttachmentsForTasks(0, rows, function(tasks) {
			if(validCallback(callback))
				callback(tasks);
		});
	});
}

function getAttachmentsForTasks(current, tasks, callback) {
	if(current === tasks.length) {
		console.log(current);
		if(validCallback(callback)) {
			callback(tasks);
		}
	} else {
		var task = tasks[current];
		getAttachmentsForTask(task.id, function(attachments) { // add attachments for task to its row entry
			task.attachments = attachments;
			console.log(attachments);
			console.log(tasks[current].attachments);
			current++;
			getAttachmentsForTasks(current, tasks, callback);
		});
	}
}

function getAttachmentsForTask(taskID, callback) {
	console.log(taskID);
	var sql = 'SELECT user_filename, internal_filename FROM task_attachments AS t INNER JOIN attachments AS a ON t.attachment = a.id WHERE t.task = $taskID';
	console.log(sql);
	dataConn.all(sql, {$taskID: taskID}, function(error, rows) {
		if(error)
			console.error(error);
			
		if(validCallback(callback))
			callback(rows);
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

function updateTaskStatus(task_id, status, callback) {
	var sql = 'UPDATE tasks SET status = $status WHERE id = $task_id';
	
	dataConn.run(sql, {
		$task_id: task_id,
		$status: status
	}, function() {
		console.log('TASK ' + task_id + ' set to completed');
		
		if(validCallback) {
			callback();
		}
	});
}

function renameRoom(room_id, new_name, callback) {
	var sql = 'UPDATE rooms SET name = $new_name WHERE id = $room_id';
	
	dataConn.run(sql, {
		$room_id: room_id,
		$new_name: new_name
	}, function() {
		console.log('ROOM ' + room_id + ' renamed to ' + new_name);
		
		if(validCallback) {
			callback();
		}
	});
}

/*###################################
  #        REMOVAL FUNCTIONS        #
  ###################################*/

function deleteRoom(room_id, callback) {
	var sql = 'DELETE FROM rooms WHERE id = $room_id';
	
	dataConn.run(sql, {$room_id: room_id}, function() {
		console.log('ROOM ' + room_id + ' deleted');
		
		if(validCallback) {
			callback();
		}
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
