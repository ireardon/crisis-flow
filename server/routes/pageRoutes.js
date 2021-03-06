var fs = require('fs');
var path = require('path');
var mime = require('mime');

var locals = require(__localModules);
var config = require(locals.config);
var security = require(locals.server.security);
var errorHandler = require(locals.server.error);
var Attachments = require(locals.server.database.Attachments)(getDatastoreConnection());
var Rooms = require(locals.server.database.Rooms)(getDatastoreConnection());

module.exports = function(aClientDirectory) {
	this.clientDirectory = aClientDirectory;

	function PageRoutes() {
		this.get = {
		    'uploadedFile': getUploadedFile,
		    'room': getRoom,
		    'messageArchive': getMessageArchive,
		    'addTask': getAddTask,
		    'manageRooms': getManageRooms,
		    'index': getIndex,
		    'signup': getSignup,
		    'signin': getSignin,
		    'signout': getSignout
		};

		this.post = {};
	}

	function getUploadedFile(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.redirect('/signin');
			return;
		}

		var filename = path.basename(request.params.filepath);
		var mimetype = mime.lookup(filename);

		Attachments.getByFilename(filename, function(error, userFilename) {
			if(error) {
				errorHandler.send404(request, response);
				return;
			}

			response.setHeader('Content-disposition', 'attachment; filename=' + userFilename);
			response.setHeader('Content-type', mimetype);

			var filestream = fs.createReadStream(path.join(__base, request.originalUrl));
			filestream.pipe(response);
		});
	}

	function getRoom(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.redirect('/signin');
			return;
		}

		var roomID = request.params.roomID;
		var username = request.session.user.username;
		Rooms.get(roomID, function(error, room) {
			if(error) {
				errorHandler.send404(request, response);
				return;
			}

			var context = {
				'room': room,
				'username': username,
				'upload_path': config.WEB_UPLOAD_PATH,
				'display_name': request.session.user.display_name
			};

			response.render('room.html', context);
		});
	}

	function getMessageArchive(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.redirect('/signin');
			return;
		}

		var roomID = request.params.roomID;
		var username = request.session.user.username;
		Rooms.get(roomID, function(error, room) {
			if(error) {
				errorHandler.send404(request, response);
				return;
			}

			var context = {
				'room': room,
				'username': username,
				'display_name': request.session.user.display_name
			};

			response.render('message_archive.html', context);
		});
	}

	function getAddTask(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.redirect('/signin');
			return;
		}

		Rooms.get(request.params.roomID, function(error) {
			if(error) {
				errorHandler.send404(request, response);
				return;
			}

			var context = {
				'username': request.session.user.username,
				'room_id': request.params.roomID,
				'display_name': request.session.user.display_name
			};

			response.render('add_task.html', context);
		});
	}

	function getManageRooms(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.redirect('/signin');
			return;
		}

		Rooms.getAll(function(error, roomsList) {
			if(error) {
				errorHandler.send404(request, response);
				return;
			}

			var context = {
				'username': request.session.user.username,
				'room_list': roomsList,
				'display_name': request.session.user.display_name
			};

			response.render('manage_rooms.html', context);
		});
	}

	function getIndex(request, response) {
		errorHandler.reportRequest(request);

		if(!security.sessionValid(request.session)) {
			response.redirect('/signin');
			return;
		}

		Rooms.getAll(function(error, roomsList) {
			if(error) {
				errorHandler.send404(request, response);
				return;
			}

			roomsList.forEach(function(room) {
				var members = clientDirectory.getClientsByRoom(room.id);
				room.num_members = members.length;
			});

			var context = {
				'username': request.session.user.username,
				'access_role': request.session.user.role,
				'room_list': roomsList,
				'display_name': request.session.user.display_name
			};
			response.render('index.html', context);
		});
	}

	function getSignup(request, response) {
		errorHandler.reportRequest(request);

		request.session.server_salt = security.getSaltBits();

		var context = {
			'server_salt': request.session.server_salt
		};
		response.render('signup.html', context);
	}

	function getSignin(request, response) {
		errorHandler.reportRequest(request);

		request.session.server_salt = security.getSaltBits();

		var context = {
			'server_salt': request.session.server_salt
		};
		response.render('signin.html', context);
	}

	function getSignout(request, response) {
		errorHandler.reportRequest(request);

		request.session.active = false;

		response.redirect('/signin');
	}

	return new PageRoutes();
}
