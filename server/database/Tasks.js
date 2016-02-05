var locals = require(__localModules);
var config = require(locals.config);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);
var Attachments = require(locals.server.database.Attachments)(getDatastoreConnection());
var TaskAttachments = require(locals.server.database.TaskAttachments)(getDatastoreConnection());
var TaskFollowups = require(locals.server.database.TaskFollowups)(getDatastoreConnection());
var TaskTags = require(locals.server.database.TaskTags)(getDatastoreConnection());

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function Tasks() {
        return {
            'create': createTask,
            'updateStatus': updateTaskStatus,
            'getAllForRoom': getAllTasksForRoom,
            'getOpenForRoom': getOpenTasksForRoom,
            'attachFiles': attachFilesToTask
        };
    }

    function createTask(room_id, author, title, high_priority, content, callback) {
    	var currTime = utils.getMillisecondTime();

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
    		report.error(error, 'Tasks.createTask failed');

    		report.debug('ADDED task in ' + room_id + ' from ' + author + ' to database');

    		if(utils.validCallback(callback)) {
    			callback(error, this.lastID, currTime);
    		}
    	});
    }

    function getAllTasksForRoom(roomID, callback) {
    	var sql = 'SELECT * FROM tasks WHERE room = $roomID ORDER BY time DESC';
    	dataConn.all(sql, {
    		$roomID: roomID
    	}, function(error, rows) {
    		report.error(error, 'Tasks.getAllTasksForRoom failed');
    		if(error) {
    			callback(error);
    			return;
    		}

    		getAdditionalsForTasks(rows, callback);
    	});
    }

    function getOpenTasksForRoom(roomID, callback) {
    	var sql = 'SELECT * FROM tasks WHERE room = $roomID AND status != $completed AND status != $cancelled ORDER BY time DESC';
    	dataConn.all(sql, {
    		$roomID: roomID,
    		$completed: config.STATUS_COMPLETED,
    		$cancelled: config.STATUS_CANCELLED
    	}, function(error, rows) {
    		report.error(error, 'Tasks.getOpenTasksForRoom failed');
    		if(error) {
    			callback(error);
    		}

    		getAdditionalsForTasks(rows, callback);
    	});
    }

    function getAdditionalsForTasks(tasks, callback) {
    	TaskAttachments.getAttachmentsForTasks(0, tasks, function(error, tasksWithAttachments) {
    		if(error) {
    			callback(error);
    			return;
    		}

    		TaskTags.getTagsForTasks(0, tasksWithAttachments, function(error, tasksWithAttachmentsAndTags) {
    			if(error) {
    				callback(error);
    				return;
    			}

    			TaskFollowups.getFollowupsForTasks(0, tasksWithAttachmentsAndTags, function(error, tasksWithAttachmentsAndTagsAndFollowups) {
    				if(utils.validCallback(callback)) {
    					callback(error, tasksWithAttachmentsAndTagsAndFollowups);
    				}
    			});
    		});
    	});
    }

    function updateTaskStatus(task_id, oldStatus, newStatus, callback) {
    	var sql = 'UPDATE tasks SET status = $newStatus WHERE id = $task_id AND status = $oldStatus';

    	dataConn.run(sql, {
    		$task_id: task_id,
    		$oldStatus: oldStatus,
    		$newStatus: newStatus
    	}, function(error) {
    		report.error(error, 'Tasks.updateTaskStatus failed');

    		report.debug('TASK ' + task_id + ' status updated');

    		if(utils.validCallback) {
    			callback(error);
    		}
    	});
    }

    function attachFilesToTask(task, files, callback) {
    	if(files.length === 0) {
    		callback(false);
    	} else {
    		var file = files.pop();

    		Attachments.create(file, function(error, attachmentID) {
    			if(error) {
    				callback(error);
    				return;
    			}

    			TaskAttachments.create(task, attachmentID, function(error) {
    				if(error) {
    					callback(error);
    					return;
    				}

    				attachFilesToTask(task, files, callback);
    			});
    		});
    	}
    }

    return new Tasks();
};
