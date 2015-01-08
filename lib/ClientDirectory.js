module.exports.ClientDirectory = ClientDirectory;
module.exports.Room = Room;
module.exports.ClientDirectoryException = ClientDirectoryException;

// the ClientDirectory enables easy lookup of clients by rooms and channels
function ClientDirectory() {
	this.clientMap = {}; // maps client ids to actual client sockets
	this.rooms = {}; // maps room ids to room objects
	
	this.getSocket = function(client) {
		return this.clientMap[client];
	};
	
	this.addRooms = function(addRooms) {
		for(var i=0; i<addRooms.length; i++) {
			var room = addRooms[i];
			if(this.rooms[room]) {
				throw new ClientDirectoryException("Cannot add duplicate room");
			}
		
			this.rooms[room] = new Room();
		}
	};
	
	this.removeRooms = function(removeRooms) {
		for(var i=0; i<removeRooms; i++) {
			var room = removeRooms[i];
			// deleting non-existent key has no effect
			delete this.rooms[room];
		}
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
	
	this.addClient = function(client, clientSocket, room, channels) {
		if(this.clientMap[client]) {
			throw new ClientDirectoryException("Cannot add duplicate client");
		}
		
		if(!this.rooms[room]) {
			throw new ClientDirectoryException("Cannot add client to non-existent room");
		}
	
		this.clientMap[client] = clientSocket;
		
		this.rooms[room].addClient(client, channels);
	};
	
	this.removeClient = function(client, room) {
		delete this.clientMap[client];
		
		if(!this.rooms[room]) {
			throw new ClientDirectoryException("Cannot remove client from non-existent room");
		}
		
		this.rooms[room].removeClient(client);
	};
	
	this.addToChannels = function(client, room, channels) {
		this.rooms[room].addToChannels(client, channels);
	};
	
	this.removeFromChannels = function(client, room, channels) {
		this.rooms[room].removeFromChannels(client, channels);
	};
}

// the Room objects stores a representation of a room and the clients within
// clients may only exist inside one room, but they may be members of an arbitrary
// number of channels within that room
function Room() {
	this.clientList = []; // a list of clients within the room
	this.channels = {}; // a mapping of channel id to a list of clients within the channel
	
	this.addChannels = function(addChannels) {
		for(var i=0; i<addChannels.length; i++) {
			var channel = addChannels[i];
			if(this.channels[channel]) {
				throw new ClientDirectoryException("Cannot add duplicate channel");
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
	
	this.addClient = function(client, addChannels) {
		var index = this.clientList.indexOf(client);
		
		if (index >= 0) {
			throw new ClientDirectoryException("Cannot add duplicate client");
		}
		
		this.clientList.push(client);
		
		for(var i=0; i<addChannels.length; i++) {
			var channel = addChannels[i];
			this.channels[channel].push(client);
		}
	};
	
	this.removeClient = function(client) {
		var index = this.clientList.indexOf(client);
		
		if (index < 0) {
			throw new ClientDirectoryException("Cannot remove non-existent client");
		}
		
		this.clientList.splice(index, 1);
		
		// check all channels and remove from any where the client is present
		for(var channel in Object.keys(this.channels)) {
			index = this.channels[channel].indexOf(client);
			if(index >= 0) {
				this.channels[channel].splice(index, 1);
			}
		}
	};
	
	this.addToChannels = function(client, addChannels) {
		for(var i=0; i<addChannels.length; i++) {
			var channel = addChannels[i];
			index = this.channels[channel].indexOf(client);
			
			if(index >= 0) {
				throw new ClientDirectoryException("Cannot add client to channel it is already a member of");
			}
			this.channels[channel].push(client);
		}
	};
	
	this.removeFromChannels = function(client, removeChannels) {
		for(var i=0; i<removeChannels.length; i++) {
			var channel = removeChannels[i];
			index = this.channels[channel].indexOf(client);
			
			if (index < 0) {
				throw new ClientDirectoryException("Cannot remove client from channel it is not a member of");
			}
			
			this.channels[channel].splice(index, 1);
		}
	};
}

function ClientDirectoryException(message) {	
	this.name = "ClientDirectoryException";
	this.message = message;
};