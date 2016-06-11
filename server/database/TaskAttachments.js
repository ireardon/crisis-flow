var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function TaskAttachments() {
        return {
            'create': createTaskAttachment,
            'getAttachmentsForTasks': getAttachmentsForTasks
        };
    }

    function createTaskAttachment(taskID, attachmentID, callback) {
    	var sql = 'INSERT INTO task_attachments(task, attachment) VALUES($task, $attachment)';
    	dataConn.run(sql, {
    		$task: taskID,
    		$attachment: attachmentID
    	}, function(error) {
    		report.error(error, 'TaskAttachments.createTaskAttachment failed');

    		if(utils.validCallback(callback)) {
    			callback(error);
    		}
    	});
    }

    function getAttachmentsForTasks(current, tasks, callback) {
    	if(current === tasks.length) {
    		if(utils.validCallback(callback)) {
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

    function getAttachmentsForTask(taskID, callback) {
    	var sql = 'SELECT a.id AS id, user_filename, internal_filename FROM task_attachments AS ta INNER JOIN attachments AS a ON ta.attachment = a.id WHERE ta.task = $taskID';
    	dataConn.all(sql, {$taskID: taskID}, function(error, rows) {
    		report.error(error, 'TaskAttachments.getAttachmentsForTask failed');

    		if(utils.validCallback(callback)) {
    			callback(error, rows);
    		}
    	});
    }

    return new TaskAttachments();
};
