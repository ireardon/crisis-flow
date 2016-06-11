var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function TaskTags() {
        return {
            'attachTagsToTask': attachTagsToTask,
            'getTagsForTasks': getTagsForTasks
        };
    }

    function attachTagsToTask(task, tags, callback) {
    	report.debug(tags);

    	if(tags.length === 0) { // no tags, so don't try to attach them
    		if(utils.validCallback(callback)) {
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
    		report.error(error, 'TaskTags.attachTagsToTask failed');

    		if(utils.validCallback(callback)) {
    			callback(error);
    		}
    	});
    }

    function getTagsForTasks(current, tasks, callback) {
    	if(current === tasks.length) {
    		if(utils.validCallback(callback)) {
    			callback(false, tasks);
    		}
    	} else {
    		var task = tasks[current];
    		getTagsForTask(task.id, function(error, tags) { // add tags for task to its row entry
    			if(error) {
    				callback(error);
    			}

    			task.tags = tags;
    			current++;
    			getTagsForTasks(current, tasks, callback);
    		});
    	}
    }

    function getTagsForTask(taskID, callback) {
    	var sql = 'SELECT t.id AS id, name FROM task_tags AS tt INNER JOIN tags AS t ON tt.tag = t.id WHERE tt.task = $taskID';
    	dataConn.all(sql, {$taskID: taskID}, function(error, rows) {
    		report.error(error, 'TaskTags.getTagsForTask failed');

    		if(utils.validCallback(callback))
    			callback(error, rows);
    	});
    }

    return new TaskTags();
};
