// this module contains the functions for all database access
var sqlite3 = require('sqlite3').verbose();
var moment = require('moment');

var assert = require('assert'); // TODO

var config = require('../config');
var report = require('../lib/report');

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
	'getUserWithPassword': getUserWithPassword,
	'getRoom': getRoom,
	'getAllRooms': getAllRooms,
	'getAllTags': getAllTags,
	'getMessagesForRoom': getMessagesForRoom,
	'getAllTasksForRoom': getAllTasksForRoom,
	'getOpenTasksForRoom': getOpenTasksForRoom,
	'getAttachmentByFilename': getAttachmentByFilename,
	'getChannelsForRoom': getChannelsForRoom,
	'getRoomOfChannel': getRoomOfChannel,
	'getUsersDictionary': getUsersDictionary,
	'updateTaskStatus': updateTaskStatus,
	'renameRoom': renameRoom,
	'renameChannel': renameChannel,
	'deleteRoom': deleteRoom,
	'deleteChannel': deleteChannel
};

/*###################################
  #       INSERTION FUNCTIONS       #
  ###################################*/

function createUser(username, password_hash, role, display_name, callback) {
	var sql = 'INSERT INTO users(username, password_hash, role, display_name) VALUES($username, $password_hash, $role, $display_name)';
	report.debug(sql);
	
	dataConn.run(sql, {
		$username: username,
		$password_hash: password_hash, 
		$role: role,
		$display_name: display_name
	}, 
	function(error) {
		report.error(error, 'dbops.createUser failed');
			
		if(validCallback(callback)) {
			callback(error);
		}
	});
}

function createRoom(roomName, callback) {
	var room_id = -1;
	
	var sql = 'INSERT INTO rooms(name) VALUES($room_name)';
	dataConn.run(sql, {$room_name: roomName}, function(error) {
		report.error(error, 'dbops.createRoom failed');
		
		room_id = this.lastID;
		report.debug('ADDED room ' + room_id + ' to database');
		
		if(validCallback(callback)) {
			callback(error, room_id);
		}
	});
}

function createMessage(room_id, author, replyTo, content, callback) {
	var currTime = getMillisecondTime();
	
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
		report.error(error, 'dbops.createMessage failed');
	
		report.debug('ADDED message in ' + room_id + ' from ' + author + ' to database');
		
		if(validCallback(callback)) {
			callback(error, this.lastID, currTime);
		}
	});
}

function createTask(room_id, author, title, high_priority, content, callback) {
	var currTime = getMillisecondTime();
	
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
		report.error(error, 'dbops.createTask failed');
	
		report.debug('ADDED task in ' + room_id + ' from ' + author + ' to database');
		
		if(validCallback(callback)) {
			callback(error, this.lastID, currTime);
		}
	});
}

function createAttachment(file, callback) {
	var sql = 'INSERT INTO attachments(user_filename, internal_filename) VALUES($user, $internal)';
	dataConn.run(sql, {
		$user: file.originalname,
		$internal: file.name
	}, function(error) {
		report.error(error, 'dbops.createAttachment failed');
			
		if(validCallback(callback)) {
			callback(error, this.lastID);
		}
	});
}

function createTaskAttachment(taskID, attachmentID, callback) {
	var sql = 'INSERT INTO task_attachments(task, attachment) VALUES($task, $attachment)';
	dataConn.run(sql, {
		$task: taskID,
		$attachment: attachmentID
	}, function(error) {
		report.error(error, 'dbops.createTaskAttachment failed');
			
		if(validCallback(callback)) {
			callback(error);
		}
	});
}

function createTag(name, callback) {
	var sql = 'INSERT INTO tags(name) VALUES($name)';
	dataConn.run(sql, {$name: name}, function(error) {
		report.error(error, 'dbops.createTag failed');
		
		if(validCallback(callback)) {
			callback(error, this.lastID);
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
			callback(false, createdIdentifiers);
		}
	} else {
		var name = names[current];
		createTag(name, function(error, newTagID) {
			if(error) {
				callback(error);
				return;
			}
			
			createdIdentifiers.push(newTagID);
			current++;
			createTagsRecursive(current, names, createdIdentifiers, callback);
		});
	}
}

function createChannel(room_id, name, callback) {
	var sql = 'SELECT COUNT(*) AS channel_count FROM channels WHERE room = $room';
	dataConn.get(sql, {$room: room_id}, function(error, row) {
		report.error(error, 'dbops.createChannel failed');
		if(error) {
			callback(error);
			return;
		}
		
		sql = 'INSERT INTO channels(room, name, color_index) VALUES($room, $name, $color_index)';
		dataConn.run(sql, {
			$room: room_id,
			$name: name,
			$color_index: row.channel_count
		}, function(error) {
			report.error(error, 'dbops.createUser failed');
			
			if(validCallback(callback)) {
				callback(error, this.lastID);
			}
		});
	});
}

function attachTagsToTask(task, tags, callback) {
	report.debug(tags);
	
	if(tags.length === 0) { // no tags, so don't try to attach them
		if(validCallback(callback)) {
			callback(false);
			return;
		}
	}
	
	var sql = 'INSERT INTO task_tags(task, tag) VALUES ';
	var context = {$task: task};
	
	for(var i=0; i<tags.length; i++) {
		var key = '$tag' + i;
		
		if(i !== 0) {
			sql += ', ';
		}
		sql += '($task, ' + key + ')';
		
		context[key] = tags[i];
	}

	report.debug(sql);
	
	dataConn.run(sql, context, function(error) {
		report.error(error, 'dbops.attachTagsToTask failed');
		
		if(validCallback(callback)) {
			callback(error);
		}
	});
}

/*###################################
  #       RETRIEVAL FUNCTIONS       #
  ###################################*/

function getSessionRecord(sessionKey, callback) {
	var sql = 'SELECT * FROM sessions WHERE sid = $sessionKey';
	sessionConn.get(sql, {$sessionKey: sessionKey}, function(error, row) {
		report.error(error, 'dbops.getSessionRecord failed');
	
		if(!row && !error) {
			error = 'Record not found';
		}
	
		if (validCallback(callback)) {
			callback(error, row);
		}
	});
}
  
function getUser(username, callback) {
	var sql = 'SELECT username, role, display_name FROM users WHERE username = $username';
	dataConn.get(sql, {$username: username}, function(error, row) {
		report.error(error, 'dbops.getUser failed');
	
		if(!row && !error) {
			error = 'Record not found';
		}
	
		if (validCallback(callback)) {
			callback(error, row);
		}
	});
}

function getUserWithPassword(username, callback) {
	var sql = 'SELECT username, password_hash, role, display_name FROM users WHERE username = $username';
	dataConn.get(sql, {$username: username}, function(error, row) {
		report.error(error, 'dbops.getUser failed');
	
		if(!row && !error) {
			error = 'Record not found';
		}
	
		if (validCallback(callback)) {
			callback(error, row);
		}
	});
}

function getRoom(roomID, callback) {
	var sql = 'SELECT * FROM rooms WHERE id = $roomID';
	dataConn.get(sql, {$roomID: roomID}, function(error, row) {
		report.error(error, 'dbops.getRoom failed');
		
		if(!row && !error) {
			error = 'Record not found';
		}
		
		if(error) {
			callback(error);
			return;
		}
	
		getChannelsForRoom(roomID, function(error, channels) {
			if(row) {
				row.channels = channels;
			}
			
			if (validCallback(callback))
				callback(error, row);
		});
	});
}

function getAllRooms(callback) {
	var sql = 'SELECT * FROM rooms ORDER BY name ASC';
	dataConn.all(sql, {}, function(error, rows) {
		report.error(error, 'dbops.getAllRooms failed');
		
		if(error) {
			callback(error);
			return;
		}
		
		getChannelsForRooms(0, rows, function(error, rooms) {
			if (validCallback(callback))
				callback(error, rooms);
		});
	});
}

function getAllTags(callback) {
	var sql = 'SELECT * FROM tags ORDER BY name ASC';
	dataConn.all(sql, {}, function(error, rows) {
		report.error(error, 'dbops.getAllTags failed');
	
		if (validCallback(callback))
			callback(error, rows);
	});
}

function getChannelsForRooms(current, rooms, callback) {
	if(current === rooms.length) {
		if(validCallback(callback)) {
			callback(false, rooms);
		}
	} else {
		var room = rooms[current];
		getChannelsForRoom(room.id, function(error, channels) { // add channels for room to its row entry
			if(error) {
				callback(error);
				return;
			}
		
			room.channels = channels;
			current++;
			getChannelsForRooms(current, rooms, callback);
		});
	}
}

function getChannelsForRoom(room_id, callback) {
	var sql = 'SELECT * FROM channels WHERE room = $room_id ORDER BY name ASC';
	dataConn.all(sql, {$room_id: room_id}, function(error, rows) {
		report.error(error, 'dbops.getChannelsForRoom failed');
			
		if(validCallback(callback))
			callback(error, rows);
	});
}

function getMessagesForRoom(roomID, limit, callback) {
	report.debug(roomID);
	var messageList = [];
	var messageIdentifierList = [];

	var sql = 'SELECT * FROM messages WHERE room = $roomID AND reply < 0 ORDER BY time DESC';
	var parameters = {$roomID: roomID};
	if(limit) {
		sql = 'SELECT * FROM messages WHERE room = $roomID AND reply < 0 ORDER BY time DESC LIMIT $limit';
		parameters.$limit = limit;
	}
	
	dataConn.each(sql, parameters, function(error, row) { // on-row callback
		report.error(error, 'dbops.getMessagesForRoom failed');
		
		messageList.push(row);
		messageIdentifierList.push(row.id);
	}, function(error, numrows) { // on-completion callback
		report.error(error, 'dbops.getMessagesForRoom failed');
	
		if(messageIdentifierList.length === 0) { // no replies are possible
			if (validCallback(callback)) {
				callback(error, messageList);
			}
		} else { // we need to gather replies to the top-level messages we've collected
			getReplies(messageList, messageIdentifierList, function(error, updatedMessagesList) {
				if (validCallback(callback)) {
					callback(error, updatedMessagesList);
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
	
	dataConn.each(sql, ids_list, 
	function(error, row) { // on-row callback
		report.error(error, 'dbops.getReplies failed');
	
		replyList.push(row);
		replyIndentifierList.push(row.id);
	}, function(error, numrows) { // on-completion callback
		report.error(error, 'dbops.getReplies failed');
		
		if(replyList.length === 0) { // replies list is empty so we can proceed with the callback
			if (validCallback(callback)) {
				callback(error, messageList);
			}
		} else { // replies list has entries, which may themselves have replies
			messageList = messageList.concat(replyList);
			getReplies(messageList, replyIndentifierList, callback);
		}
	});
}

function getAllTasksForRoom(roomID, callback) {
	var sql = 'SELECT * FROM tasks WHERE room = $roomID ORDER BY time DESC';
	dataConn.all(sql, {
		$roomID: roomID
	}, function(error, rows) {
		report.error(error, 'dbops.getAllTasksForRoom failed');
		if(error) {
			callback(error);
			return;
		}
		
		getAttachmentsForTasks(0, rows, function(error, tasksWithAttachments) {
			if(error) {
				callback(error);
				return;
			}
			getTagsForTasks(0, tasksWithAttachments, function(error, tasksWithAttachmentsAndTags) {
				if(validCallback(callback)) {
					callback(error, tasksWithAttachmentsAndTags);
				}
			});
		});
	});
}

function getOpenTasksForRoom(roomID, callback) {
	var sql = 'SELECT * FROM tasks WHERE room = $roomID AND status != $completed AND status != $cancelled ORDER BY time DESC';
	dataConn.all(sql, {
		$roomID: roomID,
		$completed: config.STATUS_COMPLETED,
		$cancelled: config.STATUS_CANCELLED
	}, function(error, rows) {
		report.error(error, 'dbops.getOpenTasksForRoom failed');
		if(error) {
			callback(error);
		}
			
		getAttachmentsForTasks(0, rows, function(error, tasksWithAttachments) {
			if(error) {
				callback(error);
			}
			getTagsForTasks(0, tasksWithAttachments, function(error, tasksWithAttachmentsAndTags) {
				if(validCallback(callback)) {
					callback(error, tasksWithAttachmentsAndTags);
				}
			});
		});
	});
}

function getAttachmentsForTasks(current, tasks, callback) {
	if(current === tasks.length) {
		if(validCallback(callback)) {
			callback(false, tasks);
		}
	} else {
		var task = tasks[current];
		getAttachmentsForTask(task.id, function(error, attachments) { // add attachments for task to its row entry
			if(error) {
				callback(error);
			}
		
			task.attachments = attachments;
			current++;
			getAttachmentsForTasks(current, tasks, callback);
		});
	}
}

function getTagsForTasks(current, tasks, callback) {
	if(current === tasks.length) {
		if(validCallback(callback)) {
			callback(false, tasks);
		}
	} else {
		var task = tasks[current];
		getTagsForTask(task.id, function(error, tags) { // add attachments for task to its row entry
			if(error) {
				callback(error);
			}
		
			task.tags = tags;
			current++;
			getTagsForTasks(current, tasks, callback);
		});
	}
}

function getAttachmentsForTask(taskID, callback) {
	var sql = 'SELECT a.id AS id, user_filename, internal_filename FROM task_attachments AS ta INNER JOIN attachments AS a ON ta.attachment = a.id WHERE ta.task = $taskID';
	dataConn.all(sql, {$taskID: taskID}, function(error, rows) {
		report.error(error, 'dbops.getAttachmentsForTask failed');
			
		if(validCallback(callback)) {
			callback(error, rows);
		}
	});
}

function getTagsForTask(taskID, callback) {
	var sql = 'SELECT t.id AS id, name FROM task_tags AS tt INNER JOIN tags AS t ON tt.tag = t.id WHERE tt.task = $taskID';
	dataConn.all(sql, {$taskID: taskID}, function(error, rows) {
		report.error(error, 'dbops.getTagsForTask failed');
			
		if(validCallback(callback))
			callback(error, rows);
	});
}

function getAttachmentByFilename(internalFilename, callback) {
	var sql = 'SELECT user_filename FROM attachments WHERE internal_filename = $internalFilename';
	dataConn.get(sql, {$internalFilename: internalFilename}, function(error, row) {
		report.error(error, 'dbops.getAttachmentByFilename failed');
			
		if(validCallback(callback)) {
			callback(error, row.user_filename);
		}
	});
}

function getRoomOfChannel(channelID, callback) {
	var sql = 'SELECT room FROM channels WHERE id = $channelID';
	dataConn.get(sql, {$channelID: channelID}, function(error, row) {
		report.error(error, 'dbops.getRoomOfChannel failed');
			
		if(validCallback(callback)) {
			callback(error, row.room);
		}
	});
}

function getUsersDictionary(callback) {
	var sql = 'SELECT username, role, display_name FROM users ORDER BY username ASC';
	dataConn.all(sql, {}, function(error, rows) {
		report.error(error, 'dbops.getUsersDictionary failed');
		
		if(error) {
			callback(error);
			return;
		}
		
		var dict = {};
		for(var i=0; i<rows.length; i++) {
			var user = rows[i];
			dict[user.username] = user;
		}
		
		if (validCallback(callback)) {
			callback(error, dict);
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
		report.error(error, 'dbops.updateTaskStatus failed');
	
		report.debug('TASK ' + task_id + ' status updated');
		
		if(validCallback) {
			callback(error);
		}
	});
}

function renameRoom(roomID, newName, callback) {
	var sql = 'UPDATE rooms SET name = $newName WHERE id = $roomID';
	
	dataConn.run(sql, {
		$roomID: roomID,
		$newName: newName
	}, function(error) {
		report.error(error, 'dbops.renameRoom failed');
	
		report.debug('ROOM ' + roomID + ' renamed to ' + newName);
		
		if(validCallback) {
			callback(error);
		}
	});
}

function renameChannel(channelID, newName, callback) {
	var sql = 'UPDATE channels SET name = $newName WHERE id = $channelID';
	
	dataConn.run(sql, {
		$channelID: channelID,
		$newName: newName
	}, function(error) {
		report.error(error, 'dbops.renameChannel failed');
	
		report.debug('CHANNEL ' + channelID + ' renamed to ' + newName);
		
		if(validCallback) {
			callback(error);
		}
	});
}

/*###################################
  #        REMOVAL FUNCTIONS        #
  ###################################*/

function deleteRoom(roomID, callback) {
	var sql = 'DELETE FROM rooms WHERE id = $roomID';
	
	dataConn.run(sql, {$roomID: roomID}, function(error) {
		report.error(error, 'dbops.deleteRoom failed');
		
		report.debug('ROOM ' + roomID + ' deleted');
		
		if(validCallback) {
			callback(error);
		}
	});
}

function deleteChannel(channelID, callback) {
	var sql = 'DELETE FROM channels WHERE id = $channelID';
	
	dataConn.run(sql, {$channelID: channelID}, function(error) {
		report.error(error, 'dbops.deleteChannel failed');
		
		report.debug('CHANNEL ' + channelID + ' deleted');
		
		if(validCallback) {
			callback(error);
		}
	});
}

/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/

function validCallback(callback) {
	return callback && typeof(callback) === 'function';
}

function getMillisecondTime() {
	return new Date().getTime() / 1000;
}

function databaseCleanup() {
	dataConn.close();
	sessionConn.close();
}
