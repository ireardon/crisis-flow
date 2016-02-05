var locals = require(__localModules);
var config = require(locals.config);
var report = require(locals.lib.report);
var security = require(locals.server.security);
var Messages = require(locals.server.database.Messages)(getDatastoreConnection());
var Tasks = require(locals.server.database.Tasks)(getDatastoreConnection());
var TaskFollowups = require(locals.server.database.TaskFollowups)(getDatastoreConnection());
var Users = require(locals.server.database.Users)(getDatastoreConnection());

module.exports = function(io, clientDirectory) {
    io.sockets.on('connection', function(socket) {
    	report.debug('SOCKET connected');

    	socket.emit('stc_rejoin');

    	// check that this socket is associated with a valid session
    	if(!security.sessionValid(socket.session)) {
    		socket.emit('recoverableError', "Session is invalid");
    		socket.disconnect();
    		return;
    	}

    	socket.user = socket.session.user.username;

    	socket.on('join', function(roomID) {
    		report.debug('ROOM JOINED');
    		socket.join(roomID);
    		socket.room = roomID;

    		clientDirectory.addClient(socket.user, socket, roomID);

    		var clientIdentifiers = clientDirectory.getClientsByRoom(socket.room);

    		Users.getAll(function(error, usersDictionary) {
    			if(error) {
    				socket.emit('recoverableError', "Failed to join");
    				return;
    			}

    			var clients = clientIdentifiers.map(function(userID) {
    				return usersDictionary[userID];
    			});

    			socket.broadcast.to(socket.room).emit('membership_change', clients);
    		});
    	});

    	// the client emits this when they want to send a message
    	socket.on('cts_message', function(message) {
    		report.debug('MESSAGE RECEIVED');
    		Messages.create(socket.room, socket.user, message.reply, message.content, function(error, messageID, submitTime) {
    			if(error) {
    				socket.emit('recoverableError', "Message failed to send.");
    				return;
    			}

    			message.id = messageID;
    			message.room = socket.room;
    			message.author = socket.user;
    			message.authorDisplayName = socket.session.user.display_name;
    			message.time = submitTime;

    			socket.emit('stc_message', message);
    			socket.broadcast.to(socket.room).emit('stc_message', message); //emit to 'room' except this socket
    		});
    	});

    	// the client emits this whenever the user marks a task as completed
    	socket.on('cts_task_status_changed', function(taskID, oldStatus, newStatus) {
    		report.debug('RECEIVED task status change');

    		oldStatus = Number(oldStatus);
    		newStatus = Number(newStatus);

    		if(!security.validStatus(oldStatus) || !security.validStatus(newStatus)) {
    			report.error('ERROR invalid task status change');
    		}

    		Tasks.updateStatus(taskID, oldStatus, newStatus, function(error) {
    			if(error) {
    				socket.emit('recoverableError', "Failed to update task status.");
    				return;
    			}

    			socket.broadcast.to(socket.room).emit('stc_task_status_changed', taskID, newStatus);
    		});
    	});

    	socket.on('cts_followup_task', function(followup) {
    		TaskFollowups.create(followup.task, followup.content, followup.author, function(error, taskFollowupID, submitTime) {
    			if(error) {
    				socket.emit('recoverableError', "Failed to create a task followup.");
    				return;
    			}

    			var taskFollowupData = {
    				'id': taskFollowupID,
    				'author': followup.author,
    				'task': followup.task,
    				'content': followup.content,
    				'time': submitTime
    			};

    			io.sockets.in(socket.room).emit('stc_followup_task', taskFollowupData);
    		});
    	});

    	// the client emits this whenever it types into the input field
    	socket.on('cts_typing', function() {
    		socket.broadcast.to(socket.room).emit('stc_typing', socket.user);
    	});

    	socket.on('cts_user_idle', function() {
    		socket.broadcast.to(socket.room).emit('stc_user_idle', socket.user);
    	});

    	socket.on('cts_user_active', function() {
    		socket.broadcast.to(socket.room).emit('stc_user_active', socket.user);
    	});

    	socket.on('cts_join_channel', function(channelID) {
    		clientDirectory.addToChannel(socket.user, socket.room, channelID);
    	});

    	socket.on('cts_leave_channel', function(channelID) {
    		clientDirectory.removeFromChannel(socket.user, socket.room, channelID);
    	});

    	// the client disconnected/closed their browser window
    	socket.on('disconnect', function() {
    		report.debug('SOCKET disconnected');

    		var roomID = socket.room;
    		// the docs say there is no need to call socket.leave(), as it happens automatically
    		// but this is clearly a lie, because it doesn't work
    		// fetch all sockets in a room

    		if(roomID !== undefined) { // if the server has gone down and no reconnect occurred, this will not exist
    			socket.leave(roomID);
    			clientDirectory.removeClient(socket.user, roomID);

    			var remainingUsersIdentifiers = clientDirectory.getClientsByRoom(roomID);

    			Users.getAll(function(error, usersDictionary) {
    				if(error) {
    					socket.emit('recoverableError', "Leave failed");
    					return;
    				}

    				var remainingUsers = remainingUsersIdentifiers.map(function(userID) {
    					return usersDictionary[userID];
    				});

    				io.sockets.in(roomID).emit('membership_change', remainingUsers);
    			});
    		}
    	});
    });

    this.addTask = function(roomID, taskData) {
        io.sockets.in(roomID).emit('stc_add_task', taskData);
    };

    return this;
}
