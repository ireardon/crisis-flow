var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function Channels() {
        return {
            'create': createChannel,
            'getForRoom': getChannelsForRoom,
            'getRoomOfChannel': getRoomOfChannel,
            'rename': renameChannel,
            'delete': deleteChannel,
            'getChannelsForRooms': getChannelsForRooms
        };
    }

    function createChannel(room_id, name, callback) {
    	var sql = 'SELECT COUNT(*) AS channel_count FROM channels WHERE room = $room';
    	dataConn.get(sql, {$room: room_id}, function(error, row) {
    		report.error(error, 'Channels.createChannel failed');
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
    			report.error(error, 'Channels.createUser failed');

    			if(utils.validCallback(callback)) {
    				callback(error, this.lastID);
    			}
    		});
    	});
    }

    function getChannelsForRooms(current, rooms, callback) {
    	if(current === rooms.length) {
    		if(utils.validCallback(callback)) {
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
    		report.error(error, 'Channels.getChannelsForRoom failed');

    		if(utils.validCallback(callback))
    			callback(error, rows);
    	});
    }

    function getRoomOfChannel(channelID, callback) {
    	var sql = 'SELECT room FROM channels WHERE id = $channelID';
    	dataConn.get(sql, {$channelID: channelID}, function(error, row) {
    		report.error(error, 'Channels.getRoomOfChannel failed');

    		if(utils.validCallback(callback)) {
    			callback(error, row.room);
    		}
    	});
    }

    function renameChannel(channelID, newName, callback) {
    	var sql = 'UPDATE channels SET name = $newName WHERE id = $channelID';

    	dataConn.run(sql, {
    		$channelID: channelID,
    		$newName: newName
    	}, function(error) {
    		report.error(error, 'Channels.renameChannel failed');

    		report.debug('CHANNEL ' + channelID + ' renamed to ' + newName);

    		if(utils.validCallback) {
    			callback(error);
    		}
    	});
    }

    function deleteChannel(channelID, callback) {
    	var sql = 'DELETE FROM channels WHERE id = $channelID';

    	dataConn.run(sql, {$channelID: channelID}, function(error) {
    		report.error(error, 'Channels.deleteChannel failed');

    		report.debug('CHANNEL ' + channelID + ' deleted');

    		if(utils.validCallback) {
    			callback(error);
    		}
    	});
    }

    return new Channels();
};
