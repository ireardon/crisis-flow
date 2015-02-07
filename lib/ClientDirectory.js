module.exports.ClientDirectory = ClientDirectory;
module.exports.Room = Room;
module.exports.ClientDirectoryException = ClientDirectoryException;

var dbops = require('./database_ops');
var report = require('./report');

// the ClientDirectory enables easy lookup of clients by rooms and channels
function ClientDirectory() {
	this.clientMap = {}; // maps client ids to actual client sockets
	this.rooms = {}; // maps room ids to room objects
	
	this.getSocket = function(client) {
		return this.clientMap[client];
	};
	
	this.addRoom = function(addRoom) {
		if(!this.rooms[addRoom]) { // if room already exists, this has no effect
			this.rooms[addRoom] = new Room();
		}
		
		return this.rooms[addRoom];
	};
	
	this.removeRoom = function(removeRoom) {
		// deleting non-existent key has no effect
		delete this.rooms[removeRoom];
	};
	
	this.getClients = function() {
		return Object.keys(this.clientMap);
	};
	
	this.getClientsByRoom = function(room) {
		return this.rooms[room].getClients();
	};
	
	this.getRoomIdentifiers = function() {
		return Object.keys(this.rooms);
	};
	
	this.getRoom = function(room) {
		return this.rooms[room];
	};
	
	// the final argument is optional, if not used defaults to all channels
	this.addClient = function(client, clientSocket, room, channels) {
		if(this.clientMap[client]) { // add client that is already present
			return;
		}
		
		if(!this.rooms[room]) { // if room is not in directory
			this.syncToDB(function() { // sync with database
				if(!this.rooms[room]) { // if it's still not in directory this is invalid
					throw new ClientDirectoryException("Cannot add client to non-existent room");
				} else {
					this.clientMap[client] = clientSocket;
					this.rooms[room].addClient(client, channels);
				}
			});
		} else {
			this.clientMap[client] = clientSocket;
			this.rooms[room].addClient(client, channels);
		}
	};
	
	this.removeClient = function(client, room) {
		delete this.clientMap[client];
		
		if(!this.rooms[room]) {
			this.syncToDB(); // if directory doesn't contain room, it may be stale, so refresh
		} else {
			this.rooms[room].removeClient(client);
		}
	};
	
	this.addToChannel = function(client, room, channel) {
		this.rooms[room].addToChannel(client, channel);
	};
	
	this.removeFromChannel = function(client, room, channel) {
		this.rooms[room].removeFromChannel(client, channel);
	};
	
	this.syncToDB = function(callback) {
		var clientDirectory = this;
		
		dbops.getAllRooms(function (error, rows) {
			if(error) {
				report.error(error, 'Cannot read database. Quitting.');
				process.exit(1);
			}
			
			for(var i=0; i<rows.length; i++) {
				var room = rows[i];
				var channelIdentifiers = room.channels.map(function(channel) { return channel.id });
				clientDirectory.addRoom(room.id).addChannels(channelIdentifiers);
			}
			
			callback();
		});
	};
}

// the Room objects stores a representation of a room and the clients within
// clients may only exist inside one room, but they may be members of an arbitrary
// number of channels within that room
function Room() {
	this.clientList = []; // a list of ids of clients within the room
	this.channels = {}; // a mapping of channel id to a list of client ids within the channel
	
	this.addChannels = function(addChannels) {
		for(var i=0; i<addChannels.length; i++) {
			var channel = addChannels[i];
			if(this.channels[channel]) {
				continue;
			}
		
			this.channels[channel] = [];
		}
	};
	
	this.removeChannels = function(removeChannels) {
		for(var i=0; i<removeChannels; i++) {
			var channel = removeChannels[i];
			// deleting non-existent key has no effect
			delete this.channels[channel];
		}
	};
	
	this.getClients = function() {
		return this.clientList;
	};
	
	this.getClientsByChannel = function(channel) {
		return this.channels[channel];
	};
	
	this.getChannelIdentifiers = function() {
		return Object.keys(this.channels);
	};
	
	// the final argument is optional, if not used defaults to all channels
	this.addClient = function(client, addChannels) {
		var index = this.clientList.indexOf(client);
		
		if (index >= 0) { // add client that is already present
			return;
		}
		
		// use all channels if not specified
		if(!addChannels) {
			addChannels = this.getChannelIdentifiers();
		}
		
		this.clientList.push(client);
		
		for(var i=0; i<addChannels.length; i++) {
			var channel = addChannels[i];
			this.channels[channel].push(client);
		}
	};
	
	this.removeClient = function(client) {
		var index = this.clientList.indexOf(client);
		
		if (index < 0) { // no effect if client does not exist
			return;
		}
		
		this.clientList.splice(index, 1);
		
		// check all channels and remove from any where the client is present
		var channelIdentifiers = this.getChannelIdentifiers();
		for(var i=0; i<channelIdentifiers.length; i++) {
			var channel = channelIdentifiers[i];
			index = this.channels[channel].indexOf(client);
			if(index >= 0) {
				this.channels[channel].splice(index, 1);
			}
		}
	};
	
	this.addToChannel = function(client, addChannel) {
		var index = this.channels[addChannel].indexOf(client);
		
		if(index >= 0) { // attempt to add client to channel it is already a member of
			return;
		}
		
		this.channels[addChannel].push(client);
	};
	
	this.removeFromChannel = function(client, removeChannel) {
		var index = this.channels[removeChannel].indexOf(client);
		
		if (index < 0) { // remove client from channel it is not a member of
			return;
		}
		
		this.channels[removeChannel].splice(index, 1);
	};
}

function ClientDirectoryException(message) {
	this.name = "ClientDirectoryException";
	this.message = message;
};