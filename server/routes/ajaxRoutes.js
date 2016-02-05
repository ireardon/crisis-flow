var locals = require(__localModules);
var config = require(locals.config);
var security = require(locals.server.security);
var errorHandler = require(locals.server.error);
var Attachments = require(locals.server.database.Attachments)(getDatastoreConnection());
var Messages = require(locals.server.database.Messages)(getDatastoreConnection());
var Rooms = require(locals.server.database.Rooms)(getDatastoreConnection());
var Tags = require(locals.server.database.Tags)(getDatastoreConnection());
var Tasks = require(locals.server.database.Tasks)(getDatastoreConnection());
var TaskTags = require(locals.server.database.TaskTags)(getDatastoreConnection());
var Users = require(locals.server.database.Users)(getDatastoreConnection());

module.exports = function(aClientDirectory, sockets) {
	this.clientDirectory = aClientDirectory;
	this.Sockets = sockets;

	function AjaxRoutes() {
		this.get = {
			'dataJSON': getDataJSON,
			'messageJSON': getMessageJSON,
			'taskJSON': getTaskJSON,
			'tagJSON': getTagJSON
		};

		this.post = {
			'sendMessage': postSendMessage,
			'createRoom': postCreateRoom,
			'deleteRoom': postDeleteRoom,
			'renameRoom': postRenameRoom,
			'createChannel': postCreateChannel,
			'deleteChannel': postDeleteChannel,
			'renameChannel': postRenameChannel,
			'addTask': postAddTask,
			'signin': postSignin,
			'signup': postSignup
		};
	}

	/*###################################
	  #           GET HANDLERS          #
	  ###################################*/

	function getDataJSON(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var roomID = request.params.roomID;
		var username = request.session.user.username;
		var displayName = request.session.user.display_name;

		Rooms.get(roomID, function(error, room) {
			if(error) {
				response.json({ 'error': 'Requested room is invalid' });
				return;
			}

			Users.getAll(function(error, usersDictionary) {
				if(error) {
					response.json({ 'error': 'Request failed' });
					return;
				}

				Messages.getMessagesForRoom(roomID, config.DEFAULT_MESSAGE_COUNT, function(error, messages) {
					if(error) {
						response.json({ 'error': 'Request failed' });
						return;
					}

					Tasks.getAllForRoom(roomID, function(error, tasks) {
						if(error) {
							response.json({ 'error': 'Request failed' });
							return;
						}

						for(var i=0; i<messages.length; i++) {
							var message = messages[i];
							message.authorDisplayName = usersDictionary[message.author].display_name;
						}

						for(var i=0; i<tasks.length; i++) {
							var task = tasks[i];
							task.authorDisplayName = usersDictionary[task.author].display_name;
						};

						var memberIdentifiers = clientDirectory.getClientsByRoom(room.id);

						var members = memberIdentifiers.map(function(member) {
							return usersDictionary[member];
						});

						var context = {
							'room': room,
							'username': username,
							'displayName': displayName,
							'members': members,
							'messages': messages,
							'tasks': tasks,
							'statusMap': config.STATUS_MAP
						};

						response.json(context);
					});
				});
			});
		});
	}

	function getMessageJSON(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var roomID = request.params.roomID;
		var username = request.session.user.username;
		Rooms.get(roomID, function(error, room) {
			if(error) {
				response.json({ 'error': 'Request room is invalid' });
				return;
			}

			Users.getAll(function(error, usersDictionary) {
				if(error) {
					response.json({ 'error': 'Request failed' });
					return;
				}

				Messages.getMessagesForRoom(roomID, false, function(error, messages) {
					if(error) {
						response.json({ 'error': 'Request failed' });
						return;
					}

					for(var i=0; i<messages.length; i++) {
						var message = messages[i];
						message.authorDisplayName = usersDictionary[message.author].display_name;
					}

					var context = {
						'room': room,
						'username': username,
						'messages': messages
					};

					response.json(context);
				});
			});
		});
	}

	function getTaskJSON(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var roomID = request.params.roomID;
		var username = request.session.user.username;
		Rooms.get(roomID, function(error, room) {
			if(error) {
				response.json({ 'error': 'Requested room is invalid' });
				return;
			}


			Users.getAll(function(error, usersDictionary) {
				if(error) {
					response.json({ 'error': 'Request failed' });
					return;
				}

				Tasks.getAllForRoom(roomID, function(error, tasks) {
					if(error) {
						response.json({ 'error': 'Request failed' });
						return;
					}

					for(var i=0; i<tasks.length; i++) {
						var task = tasks[i];
						task.authorDisplayName = usersDictionary[task.author].display_name;
					};

					var context = {
						'room': room,
						'username': username,
						'tasks': tasks,
						'statusMap': config.STATUS_MAP
					};

					response.json(context);
				});
			});
		});
	}

	function getTagJSON(request, response) {
		errorHandler.reportRequest(request);

		Tags.getAll(function(error, tags) {
			if(error) {
				response.json({ 'error': 'Request failed' });
				return;
			}

			response.json(tags);
		});
	}

	/*###################################
	  #          POST HANDLERS          #
	  ###################################*/

	function postSendMessage(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var roomID = request.params.roomID;
		var username = request.session.user.username;
		var message = request.body.message;

		Messages.create(roomID, username, message, function(error, submitTime) {
			if(error) {
				response.json({ 'error': 'Request failed' });
				return;
			}

			response.json(submitTime);
		});
	}

	function postCreateRoom(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var roomName = request.body.room_name;
		Rooms.create(roomName, function(error, roomID) {
			if(error) {
				response.json({ 'error': 'Failed to create room' });
				return;
			}

			clientDirectory.addRoom(roomID);
			response.json(roomID);
		});
	}

	function postDeleteRoom(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var roomID = request.body.room_id;
		clientDirectory.removeRoom(roomID);
		Rooms.delete(roomID, function(error) {
			if(error) {
				response.json({ 'error': 'Requested deletion of invalid room' });
				return;
			}

			response.json(roomID);
		});
	}

	function postRenameRoom(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		Rooms.rename(request.body.room_id, request.body.new_name, function(error) {
			if(error) {
				response.json({ 'error': 'Requested rename of invalid room' });
				return;
			}

			response.json(request.body.room_id);
		});
	}

	function postCreateChannel(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var roomID = request.body.room_id;
		var channelName = request.body.channel_name;
		Channel.create(roomID, channelName, function(error, channelID) {
			if(error) {
				response.json({ 'error': 'Failed to create channel' });
				return;
			}

			clientDirectory.getRoom(roomID).addChannels([channelID]);
			response.json(channelID);
		});
	}

	function postDeleteChannel(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var channelID = request.body.channel_id;
		Channels.getRoomOfChannel(channelID, function(error, roomID) {
			if(error) {
				response.json({ 'error': 'Requested channel does not exist' });
				return;
			}

			Channel.delete(channelID, function(error) {
				if(error) {
					response.json({ 'error': 'Failed to delete channel' });
					return;
				}

				clientDirectory.getRoom(roomID).removeChannels([channelID]);
				response.json(roomID);
			});
		});
	}

	function postRenameChannel(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		Channel.rename(request.body.channel_id, request.body.channel_name, function(error) {
			if(error) {
				response.json({ 'error': 'Requested rename of invalid channel' });
				return;
			}

			response.json(request.body.channel_id);
		});
	}

	function postAddTask(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.json({ 'error': 'Session is invalid' });
			return;
		}

		var roomID = request.params.roomID;
		var author = request.session.user.username;
		var highPriority = JSON.parse(request.body.high_priority);
		var selectedTags = request.body.tags;

		var files = Object.keys(request.files).map(function(key) {
			return request.files[key];
		});

		Rooms.get(roomID, function(error) {
			if(error) {
				response.json({ 'error': 'Requested room is invalid' });
				return;
			}

			Tags.getAll(function(error, preexistingTags) {
				if(error) {
					response.json({ 'error': 'Request failed' });
					return;
				}

				var preexistingTagIdentifiers = preexistingTags.map(function(tag) {
					return tag.id;
				});

				Tags.createNewTags(selectedTags, preexistingTagIdentifiers, function(error, allSelectedTags) { // returns a list of the tag IDs of both new and preexisting selected tags
					if(error) {
						response.json({ 'error': 'Request failed' });
						return;
					}

					Tasks.create(roomID, author, request.body.title, highPriority, request.body.content, function(error, taskID, submitTime) {
						if(error) {
							response.json({ 'error': 'Request failed' });
							return;
						}

						TaskTags.attachTagsToTask(taskID, allSelectedTags, function(error) {
							if(error) {
								response.json({ 'error': 'Request failed' });
								return;
							}

							Tasks.attachFiles(taskID, files, function(error) {
								if(error) {
									response.json({ 'error': 'Request failed' });
									return;
								}

								var attachments = files.map(function(file) {
									return {'user_filename': file.orginalname, 'internal_filename': file.name};
								});

								var taskData = {
									'id': taskID,
									'room': roomID,
									'author': author,
									'authorDisplayName': request.session.user.display_name,
									'title': request.body.title,
									'status': config.STATUS_SUBMITTED,
									'high_priority': highPriority,
									'content': request.body.content,
									'time': submitTime,
									'tags': allSelectedTags,
									'attachments': attachments,
									'followups': []
								};

								Sockets.addTask(roomID, taskData);

								response.redirect('/rooms/' + roomID);
							});
						});
					});
				});
			});
		});
	}

	function postSignin(request, response) {
		errorHandler.reportRequest(request);

		var username = request.body.username;

		Users.getWithPassword(username, function(error, userWithPassword) {
			if(error) {
				response.json({ 'error': 'Username is invalid' });
				return;
			}

			var valid_password = security.verifyPasswordHash(userWithPassword, request.body.client_salted_hash, request.body.client_salt, request.session.server_salt);

			if(valid_password) {
				delete request.session.server_salt;
				request.session.active = true;

				delete userWithPassword.password_hash
				request.session.user = userWithPassword;

				response.json({ 'success': true });
				return;
			} else {
				response.json({ 'error': 'Password is incorrect' });
				return;
			}
		});
	}

	function postSignup(request, response) {
		errorHandler.reportRequest(request);

		var roleAccess = security.getAccessRole(request.body.access_code_salted_hash, request.body.client_salt, request.session.server_salt);

		if(!roleAccess) {
			response.json({ 'error': 'Access code is incorrect' });
		} else {
			Users.create(request.body.username, request.body.hashed_password, roleAccess, request.body.display_name, function(error) {
				if(error) {
					response.json({ 'error': 'Request username is already in use' });
				} else {
					response.json({ 'success': true });
				}
			});
		}
	}

	return new AjaxRoutes();
}
