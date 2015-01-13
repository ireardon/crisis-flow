// this module contains the functions for all database access
var sqlite3 = require('sqlite3').verbose();
var moment = require('moment');

var assert = require('assert'); // TODO

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
	'createTags': createTags,
	'createChannel': createChannel,
	'attachTagsToTask': attachTagsToTask,
	'getSessionRecord': getSessionRecord,
	'getUser': getUser,
	'getRoom': getRoom,
	'getAllRooms': getAllRooms,
	'getAllTags': getAllTags,
	'getMessagesForRoom': getMessagesForRoom,
	'getOpenTasksForRoom': getOpenTasksForRoom,
	'getAttachmentByFilename': getAttachmentByFilename,
	'getChannelsForRoom': getChannelsForRoom,
	'getRoomOfChannel': getRoomOfChannel,
	'updateTaskStatus': updateTaskStatus,
	'renameRoom': renameRoom,
	'renameChannel': renameChannel,
	'deleteRoom': deleteRoom,
	'deleteChannel': deleteChannel
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

function createMessage(room_id, author, replyTo, content, callback) {
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
		
		if(validCallback(callback)) {
			callback(currTime);
		}
	});
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

function createTag(name, callback) {
	var sql = 'INSERT INTO tags(name) VALUES($name)';
	dataConn.run(sql, {$name: name}, function(error) {
		if(error) {
			console.error(error);
		}
		
		if(validCallback(callback)) {
			callback(this.lastID);
		}
	});
}

// callback is called with an arg which is the ids of all created tags
function createTags(names, callback) {
	createTagsRecursive(0, names, [], callback);
}

function createTagsRecursive(current, names, createdIdentifiers, callback) {
	if(current === names.length) {
		if(validCallback(callback)) {
			callback(createdIdentifiers);
		}
	} else {
		var name = names[current];
		createTag(name, function(newTagID) {
			createdIdentifiers.push(newTagID);
			current++;
			createTagsRecursive(current, names, createdIdentifiers, callback);
		});
	}
}

function createChannel(room_id, name, callback) {
	var sql = 'SELECT COUNT(*) AS channel_count FROM channels WHERE room = $room';
	dataConn.get(sql, {$room: room_id}, function(error, row) {
		if(error) {
			console.error(error);
		}
		
		sql = 'INSERT INTO channels(room, name, color_index) VALUES($room, $name, $color_index)';
		dataConn.run(sql, {
			$room: room_id,
			$name: name,
			$color_index: row.channel_count
		}, function(error) {
			if(error) {
				console.error(error);
			}
			
			if(validCallback(callback)) {
				callback(this.lastID);
			}
		});
	});
}

function attachTagsToTask(task, tags, callback) {
	var sql = 'INSERT INTO task_tags(task, tag) VALUES ';
	var context = {$task: task};
	
	for(var i=0; i<tags.length; i++) {
		var key = '$tag' + i;
		console.log(key);
		
		if(i !== 0) {
			sql += ', ';
		}
		sql += '($task, ' + key + ')';
		
		context[key] = tags[i];
	}

	console.log(sql);
	
	dataConn.run(sql, context, function(error) {
		if(error) {
			console.error(error);
		}
		
		if(validCallback(callback)) {
			callback();
		}
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

function getRoom(roomID, callback) {
	var sql = 'SELECT * FROM rooms WHERE id = $roomID';
	dataConn.get(sql, {$roomID: roomID}, function(error, row) {
		if(error)
			console.error(error);
	
		getChannelsForRoom(roomID, function(channels) {
			row.channels = channels;
			
			if (validCallback(callback))
				callback(row);
		});
	});
}

function getAllRooms(callback) {
	var sql = 'SELECT * FROM rooms ORDER BY name ASC';
	dataConn.all(sql, {}, function(error, rows) {
		if(error)
			console.error(error);
		
		getChannelsForRooms(0, rows, function(rooms) {
			if (validCallback(callback))
				callback(rooms);
		});
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

function getChannelsForRooms(current, rooms, callback) {
	if(current === rooms.length) {
		if(validCallback(callback)) {
			callback(rooms);
		}
	} else {
		var room = rooms[current];
		getChannelsForRoom(room.id, function(channels) { // add channels for room to its row entry
			room.channels = channels;
			current++;
			getChannelsForRooms(current, rooms, callback);
		});
	}
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

// gathers top-level messages and then 
function getMessagesForRoom(room_id, limit, callback) {
	var messageList = [];
	var messageIdentifierList = [];

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
		messageList.push(row);
		messageIdentifierList.push(row.id);
	}, function(error, numrows) { // on-completion callback
		if(error)
			console.error(error);
	
		assert.equal(numrows, messageList.length);
		assert.equal(numrows, messageIdentifierList.length);
	
		if(messageIdentifierList.length === 0) { // no replies are possible
			if (validCallback(callback)) {
				callback(messageList);
			}
		} else { // we need to gather replies to the top-level messages we've collected
			getReplies(messageList, messageIdentifierList, function(updatedMessagesList) {
				if (validCallback(callback)) {
					callback(updatedMessagesList);
				}
			});
		}
	});
}

function getReplies(messageList, ids_list, callback) {
	var replyList = [];
	var replyIndentifierList = [];
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
		replyList.push(row);
		replyIndentifierList.push(row.id);
	}, function(error, numrows) { // on-completion callback
		if(error)
			console.error(error);
		
		assert.equal(numrows, replyList.length);
		assert.equal(numrows, replyIndentifierList.length);
		
		if(replyList.length === 0) { // replies list is empty so we can proceed with the callback
			if (validCallback(callback)) {
				callback(messageList);
			}
		} else { // replies list has entries, which may themselves have replies
			messageList = messageList.concat(replyList);
			getReplies(messageList, replyIndentifierList, callback);
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
			
		getAttachmentsForTasks(0, rows, function(tasksWithAttachments) {
			getTagsForTasks(0, tasksWithAttachments, function(tasksWithAttachmentsAndTags) {
				if(validCallback(callback)) {
					callback(tasksWithAttachmentsAndTags);
				}
			});
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
			current++;
			getAttachmentsForTasks(current, tasks, callback);
		});
	}
}

function getTagsForTasks(current, tasks, callback) {
	if(current === tasks.length) {
		console.log(current);
		if(validCallback(callback)) {
			callback(tasks);
		}
	} else {
		var task = tasks[current];
		getTagsForTask(task.id, function(tags) { // add attachments for task to its row entry
			task.tags = tags;
			current++;
			getTagsForTasks(current, tasks, callback);
		});
	}
}

function getAttachmentsForTask(taskID, callback) {
	var sql = 'SELECT user_filename, internal_filename FROM task_attachments AS ta INNER JOIN attachments AS a ON ta.attachment = a.id WHERE ta.task = $taskID';
	dataConn.all(sql, {$taskID: taskID}, function(error, rows) {
		if(error)
			console.error(error);
			
		if(validCallback(callback))
			callback(rows);
	});
}

function getTagsForTask(taskID, callback) {
	var sql = 'SELECT name FROM task_tags AS tt INNER JOIN tags AS t ON tt.tag = t.id WHERE tt.task = $taskID';
	dataConn.all(sql, {$taskID: taskID}, function(error, rows) {
		if(error)
			console.error(error);
			
		if(validCallback(callback))
			callback(rows);
	});
}

function getAttachmentByFilename(internalFilename, callback) {
	var sql = 'SELECT user_filename FROM attachments WHERE internal_filename = $internalFilename';
	dataConn.get(sql, {$internalFilename: internalFilename}, function(error, row) {
		if(error)
			console.error(error);
			
		if(validCallback(callback)) {
			callback(row.user_filename);
		}
	});
}

function getRoomOfChannel(channelID, callback) {
	var sql = 'SELECT room FROM channels WHERE id = $channelID';
	dataConn.get(sql, {$channelID: channelID}, function(error, row) {
		if(error)
			console.error(error);
			
		if(validCallback(callback)) {
			callback(row.room);
		}
	});
}

/*###################################
  #         UPDATE FUNCTIONS        #
  ###################################*/

function updateTaskStatus(task_id, oldStatus, newStatus, callback) {
	var sql = 'UPDATE tasks SET status = $newStatus WHERE id = $task_id AND status = $oldStatus';
	
	dataConn.run(sql, {
		$task_id: task_id,
		$oldStatus: oldStatus,
		$newStatus: newStatus
	}, function(error) {
		if(error)
			console.error(error);
	
		console.log('TASK ' + task_id + ' status updated');
		
		if(validCallback) {
			callback();
		}
	});
}

function renameRoom(roomID, newName, callback) {
	var sql = 'UPDATE rooms SET name = $newName WHERE id = $roomID';
	
	dataConn.run(sql, {
		$roomID: roomID,
		$newName: newName
	}, function(error) {
		if(error)
			console.error(error);
	
		console.log('ROOM ' + roomID + ' renamed to ' + newName);
		
		if(validCallback) {
			callback();
		}
	});
}

function renameChannel(channelID, newName, callback) {
	var sql = 'UPDATE channels SET name = $newName WHERE id = $channelID';
	
	dataConn.run(sql, {
		$channelID: channelID,
		$newName: newName
	}, function(error) {
		if(error)
			console.error(error);
	
		console.log('CHANNEL ' + channelID + ' renamed to ' + newName);
		
		if(validCallback) {
			callback();
		}
	});
}

/*###################################
  #        REMOVAL FUNCTIONS        #
  ###################################*/

function deleteRoom(roomID, callback) {
	var sql = 'DELETE FROM rooms WHERE id = $roomID';
	
	dataConn.run(sql, {$roomID: roomID}, function(error) {
		if(error)
			console.error(error);
		
		console.log('ROOM ' + roomID + ' deleted');
		
		if(validCallback) {
			callback();
		}
	});
}

function deleteChannel(channelID, callback) {
	var sql = 'DELETE FROM channels WHERE id = $channelID';
	
	dataConn.run(sql, {$channelID: channelID}, function(error) {
		if(error)
			console.error(error);
		
		console.log('CHANNEL ' + channelID + ' deleted');
		
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
