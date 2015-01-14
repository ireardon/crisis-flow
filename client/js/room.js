var TYPE_DELAY = 2000;
var TIME_REFRESH_DELAY = 15000;
var members_typing_cooldown = {};
var members_typing_flag = {};
var global_roomID, global_username;
var typing_interval_id = -1;
var time_refresh_interval = -1;
var destroyReply;

var angularApp = angular.module('room', []);

angularApp.controller('ContextController', function($scope) {
	angular.element(document).ready(function() {
		jQuery.ajax({
			type: 'GET',
			url: '/rooms/' + global_roomID + '/data',
			dataType: 'json',
			success: function(data) {
				$scope.username = data.username;
				$scope.room = data.room;
				$scope.tasks = data.tasks;
				$scope.messages = data.messages;
				$scope.statusStrings = data.statusMap;
				$scope.replyTargetMessage = -1;
				$scope.replyTargetAuthor = -1;
				$scope.members = data.members.map(function(name) {
					return {username: name, idle: false};
				});
				$scope.members.push({username: $scope.username, idle: false});
				console.log($scope.members);
				
				$scope.$apply();
			
				socket.emit('join', $scope.room.id, $scope.username);
				
				scrollBottom('#messages');
				scrollBottom('#tasks');
				refreshTimeagos();
				
				time_refresh_interval = window.setInterval(refreshTimeagos, TIME_REFRESH_DELAY);
			}
		});
		
		socket.on('error', function(message) { // message is an event object for some reason, not a string
			console.error(message);
			console.error('Error: Web socket disconnected');
			alert('Error: Web socket disconnected: ' + message);
			window.location.href = '/';
		});
		
		socket.on('membership_change', function(members) {
			$scope.members = members.map(function(name) {
				return {username: name, idle: false};
			});
		});
		
		socket.on('stc_add_task', function(newTask) {
			$scope.tasks.push(newTask);
			$scope.$apply();
		});
		
		socket.on('stc_message', function(newMessage) {
			console.log(newMessage);
		
			removeTypingNote(newMessage.author);
			$scope.messages.push(newMessage);
			$scope.$apply();
		});
		
		socket.on('stc_user_idle', function(username) {
			var member = getUserByUsername($scope.members, username);
			if(member) {
				member.idle = true;
				$scope.$apply();
			}
		});
		
		socket.on('stc_user_active', function(username) {
			var member = getUserByUsername($scope.members, username);
			if(member) {
				member.idle = false;
				$scope.$apply();
			}
		});
		
		$scope.enterInputMessage = function($event) {
			if($event.charCode === 13 && $event.shiftKey === false) { // this was an 'enter' keypress
				$event.preventDefault();
				$scope.addMessage();
			}
		}; 
		
		$scope.initReply = function(messageID) {
			var message = getEntryByID($scope.messages, messageID);
			$scope.replyTargetMessage = messageID;
			$scope.replyTargetAuthor = message.author;
			
			$('#input_message').data('reply-target-author', $scope.replyTargetAuthor);
			$('#input_message').popover('show');
		}
		
		destroyReply = $scope.destroyReply = function() {
			$scope.replyTargetMessage = -1;
			$scope.replyTargetAuthor = -1;
			
			$('#input_message').data('reply-target-author', $scope.replyTargetAuthor);
			$('#input_message').popover('hide');
		}
		
		$scope.formatTaskTime = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var niceTime = moment.unix(task.time).format('h:mma [on] MMM D, YYYY');
			return niceTime;
		};
		
		$scope.advanceTaskStatus = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var currentStatus = task.status;
			var newStatus = currentStatus + 1;
			
			socket.emit('cts_task_status_changed', taskID, currentStatus, newStatus);
			task.status = newStatus;
		};
		
		$scope.retreatTaskStatus = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var currentStatus = task.status;
			var newStatus = currentStatus - 1;
			
			socket.emit('cts_task_status_changed', taskID, currentStatus, newStatus);
			task.status = newStatus;
		};
		
		$scope.addMessage = function() {
			if(!$scope.inputMessage) {
				return false;
			}
			
			var messageData = {
				'room': global_roomID,
				'author': global_username,
				'content': $scope.inputMessage,
				'reply': $scope.replyTargetMessage
			};
			
			socket.emit('cts_message', messageData);
			console.log('emitting');
			console.log(messageData);
			
			$scope.destroyReply();
			
			// $scope.messages.push(messageData); // TODO do we use a temporary?
			
			$scope.inputMessage = '';
			$('#input_message').trigger('autosize.resize'); // necessary to get textarea to resize
			scrollBottom('#messages');
			
			return false;
		};
	});
});

function getEntryByID(list, id) {
	var entry = false;
	list.forEach(function(element) {
		if(element.id === id) {
			entry = element;
		}
	});
	
	return entry;
}

function getUserByUsername(list, username) {
	var user = false;
	list.forEach(function(element) {
		if(element.username === username) {
			user = element;
		}
	});
	
	return user;
}

$(document).ready(function() {
	global_roomID = document.querySelector('meta[name=room_id]').content;
	global_username = document.querySelector('meta[name=username]').content;
	
	$('#input_message').autosize();
	$('#input_message').popover({
		html: true,
		placement: 'left',
		trigger: 'manual',
		content: function() {
			var replyTargetAuthor = $('#input_message').data('reply-target-author');
			var htmlString = '<span id="reply_popover_content">Replying to ' + replyTargetAuthor + '</span>' + 
							'<button id="close_reply_popover" onclick="destroyReply()" type="button" class="close">&times;</button>';
			return htmlString;
		}
	});
	
	//typing_interval_id = window.setInterval(checkTyping, TYPE_DELAY);
	
	socket.on('stc_typing', function(username) {
		if(!members_typing_cooldown[username]) {
			members_typing_cooldown[username] = true;
		}
		
		if(!members_typing_flag[username]) {
			addTypingNote(username);
			members_typing_flag[username] = true;
		}
	});
	
	$('#sidebar').mouseenter(function() {
		var $this = $(this);
		
		$('#sidebar_content').stop(false, true).show({
			'effect': 'fade',
			'duration': 300,
			'queue': false
		});
		$this.stop().animate({ // properties
			'width': '200px'
		}, { // options
			'duration': 400,
			'queue': false
		});
	});
	
	$('#sidebar').mouseleave(function() {
		var $this = $(this);
		
		$('#sidebar_content').stop(false, true).hide({
			'effect': 'fade',
			'duration': 300,
			'queue': false
		});
		$this.stop().animate({ // properties
			'width': '25px'
		}, { // options
			'duration': 400
		});
	});

	$('.channel_toggle').on('click', function() {
		var sockEvent = 'cts_leave_channel';
		if(this.checked) {
			sockEvent = 'cts_join_channel';
		}
		
		var channelID = $(this).data('channel-id');
		socket.emit(sockEvent, channelID);
	});
	
	// user has switched away from current tab
	$(window).blur(function() {
		socket.emit('cts_user_idle');
	});
	
	// user has switched back to current tab
	$(window).focus(function() {
		socket.emit('cts_user_active');
	});
});

function checkTyping() {
	for(var i=0; i<room_members.length; i++) {
		var curr_member = room_members[i];
		if(members_typing_cooldown[curr_member]) {
			members_typing_cooldown[curr_member] = false;
		} else {
			removeTypingNote(curr_member);
		}
	}
}

function refreshTimeagos() {
	$('.task').each(function(i, element) {
		var $task = $(element);
		var niceTime = moment.unix($task.data('task-time')).fromNow();
		$task.attr('title', niceTime);
	});
	
	$('.message').each(function(i, element) {
		var $message = $(element);
		var niceTime = moment.unix($message.data('message-time')).fromNow();
		$message.attr('title', niceTime);
	});
	
	$('[data-toggle="tooltip"]').tooltip({animation: false, container: 'body'}); // enable bootstrap tooltips
}

function scrollBottom(elementID) {
	var $display = $(elementID);
	$display.scrollTop($display.height() + 1); // there is no scroll bottom, but this should do
}

function getMilliseconds() {
	return new Date().getTime() / 1000;
}
