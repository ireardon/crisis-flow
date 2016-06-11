var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function Messages() {
        return {
            'create': createMessage,
            'getMessagesForRoom': getMessagesForRoom
        };
    }

    function createMessage(room_id, author, replyTo, content, callback) {
    	var currTime = utils.getMillisecondTime();

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
    		report.error(error, 'Messages.createMessage failed');

    		report.debug('ADDED message in ' + room_id + ' from ' + author + ' to database');

    		if(utils.validCallback(callback)) {
    			callback(error, this.lastID, currTime);
    		}
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
    		report.error(error, 'Messages.getMessagesForRoom failed');

    		messageList.push(row);
    		messageIdentifierList.push(row.id);
    	}, function(error, numrows) { // on-completion callback
    		report.error(error, 'Messages.getMessagesForRoom failed');

    		if(messageIdentifierList.length === 0) { // no replies are possible
    			if (utils.validCallback(callback)) {
    				callback(error, messageList);
    			}
    		} else { // we need to gather replies to the top-level messages we've collected
    			getReplies(messageList, messageIdentifierList, function(error, updatedMessagesList) {
    				if (utils.validCallback(callback)) {
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
    		report.error(error, 'Messages.getReplies failed');

    		replyList.push(row);
    		replyIndentifierList.push(row.id);
    	}, function(error, numrows) { // on-completion callback
    		report.error(error, 'Messages.getReplies failed');

    		if(replyList.length === 0) { // replies list is empty so we can proceed with the callback
    			if (utils.validCallback(callback)) {
    				callback(error, messageList);
    			}
    		} else { // replies list has entries, which may themselves have replies
    			messageList = messageList.concat(replyList);
    			getReplies(messageList, replyIndentifierList, callback);
    		}
    	});
    }

    return new Messages();
};
