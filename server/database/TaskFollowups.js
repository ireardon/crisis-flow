var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function TaskFollowups() {
        return {
            'create': createTaskFollowup,
            'getFollowupsForTasks': getFollowupsForTasks
        };
    }

    function createTaskFollowup(task, content, author, callback) {
    	var currTime = utils.getMillisecondTime();

    	var sql = 'INSERT INTO task_followups(task, content, author, time) VALUES($task, $content, $author, $currTime)';
    	dataConn.run(sql, {
    		$task: task,
    		$content: content,
    		$author: author,
    		$currTime: currTime
    	}, function(error) {
    		report.error(error, 'TaskFollowups.createTaskFollowup failed');

    		if(utils.validCallback(callback)) {
    			callback(error, this.lastID, currTime);
    		}
    	});
    }

    function getFollowupsForTasks(current, tasks, callback) {
    	if(current === tasks.length) {
    		if(utils.validCallback(callback)) {
    			callback(false, tasks);
    		}
    	} else {
    		var task = tasks[current];
    		getFollowupsForTask(task.id, function(error, followups) {
    			if(error) {
    				callback(error);
    			}

    			task.followups = followups;
    			current++;
    			getFollowupsForTasks(current, tasks, callback);
    		});
    	}
    }

    function getFollowupsForTask(taskID, callback) {
    	var sql = 'SELECT * FROM task_followups WHERE task = $taskID';
    	dataConn.all(sql, {$taskID: taskID}, function(error, rows) {
    		report.error(error, 'TaskFollowups.getFollowupsForTask failed');

    		if(utils.validCallback(callback))
    			callback(error, rows);
    	});
    }

    return new TaskFollowups();
};
