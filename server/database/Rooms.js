var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);
var Channels = require(locals.server.database.Channels)(getDatastoreConnection());

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function Rooms() {
        return {
            'create': createRoom,
            'get': getRoom,
            'getAll': getAllRooms,
            'rename': renameRoom,
            'delete': deleteRoom
        };
    }

    function createRoom(roomName, callback) {
    	var room_id = -1;

    	var sql = 'INSERT INTO rooms(name) VALUES($room_name)';
    	dataConn.run(sql, {$room_name: roomName}, function(error) {
    		report.error(error, 'Rooms.createRoom failed');

    		room_id = this.lastID;
    		report.debug('ADDED room ' + room_id + ' to database');

    		if(utils.validCallback(callback)) {
    			callback(error, room_id);
    		}
    	});
    }

    function getRoom(roomID, callback) {
    	var sql = 'SELECT * FROM rooms WHERE id = $roomID';
    	dataConn.get(sql, {$roomID: roomID}, function(error, row) {
    		report.error(error, 'Rooms.getRoom failed');

    		if(!row && !error) {
    			error = 'Record not found';
    		}

    		if(error) {
    			callback(error);
    			return;
    		}

    		Channels.getForRoom(roomID, function(error, channels) {
    			if(row) {
    				row.channels = channels;
    			}

    			if (utils.validCallback(callback))
    				callback(error, row);
    		});
    	});
    }

    function getAllRooms(callback) {
    	var sql = 'SELECT * FROM rooms ORDER BY name ASC';
    	dataConn.all(sql, {}, function(error, rows) {
    		report.error(error, 'Rooms.getAllRooms failed');

    		if(error) {
    			callback(error);
    			return;
    		}

    		Channels.getChannelsForRooms(0, rows, function(error, rooms) {
    			if (utils.validCallback(callback))
    				callback(error, rooms);
    		});
    	});
    }

    function renameRoom(roomID, newName, callback) {
    	var sql = 'UPDATE rooms SET name = $newName WHERE id = $roomID';

    	dataConn.run(sql, {
    		$roomID: roomID,
    		$newName: newName
    	}, function(error) {
    		report.error(error, 'Rooms.renameRoom failed');

    		report.debug('ROOM ' + roomID + ' renamed to ' + newName);

    		if(utils.validCallback) {
    			callback(error);
    		}
    	});
    }

    function deleteRoom(roomID, callback) {
    	var sql = 'DELETE FROM rooms WHERE id = $roomID';

    	dataConn.run(sql, {$roomID: roomID}, function(error) {
    		report.error(error, 'Rooms.deleteRoom failed');

    		report.debug('ROOM ' + roomID + ' deleted');

    		if(utils.validCallback) {
    			callback(error);
    		}
    	});
    }

    return new Rooms();
};
