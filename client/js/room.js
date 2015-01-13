var TYPE_DELAY = 2000;
var TIME_REFRESH_DELAY = 15000;
var displayed_messages = 0;
var room_members = [];
var members_typing_cooldown = {};
var members_typing_flag = {};
var global_roomID, global_username;
var typing_interval_id = -1;
var time_refresh_interval = -1;

var angularApp = angular.module('room', []);

angularApp.controller('ContextController', function($scope) {
	console.log(this);

	angular.element(document).ready(function() {
		jQuery.ajax({
			url: '/rooms/' + global_roomID + '/data',
			dataType: 'json',
			success: function(data) {
				$scope.username = data.username;
				$scope.room = data.room;
				$scope.tasks = data.tasks;
				$scope.messages = data.messages;
				$scope.statusStrings = data.statusMap;
				$scope.$apply();
			
				socket.emit('join', global_roomID, global_username);
			}
		});
		
		socket.on('stc_add_task', function(newTask) {
			$scope.tasks.push(newTask);
			$scope.$apply();
		});
		
		socket.on('stc_message', function(newMessage) {
			removeTypingNote(newMessage.author);
			$scope.messages.push(newMessage);
			$scope.$apply();
		});
		
		$scope.advanceTaskStatus = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var currentStatus = task.status;
			var newStatus = currentStatus + 1;
			console.log('advance ' + taskID);
			console.log('newStatus ' + newStatus);
			socket.emit('cts_task_status_changed', taskID, currentStatus, newStatus);
			task.status = newStatus;
			console.log('Message emitted!');
		};
		
		$scope.retreatTaskStatus = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var currentStatus = task.status;
			var newStatus = currentStatus - 1;
			console.log('advance ' + taskID);
			console.log('newStatus ' + newStatus);
			socket.emit('cts_task_status_changed', taskID, currentStatus, newStatus);
			task.status = newStatus;
			console.log('Message emitted!');
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

$(document).ready(function() {
	global_roomID = document.querySelector('meta[name=room_id]').content;
	global_username = document.querySelector('meta[name=username]').content;
	
	$('#input_message').autosize();
	$('#input_message').popover({
		html: true,
		placement: 'left',
		trigger: 'manual',
		content: function() {
			var replyTargetAuthor = $(this).data('reply-target-author');
			var htmlString = '<span>Replying to ' + replyTargetAuthor + '</span>' + 
							'<button id="close_reply_popover" onclick="destroyReply();" type="button" class="close">&times;</button>';
			return htmlString;
		}
	});
	
	typing_interval_id = window.setInterval(checkTyping, TYPE_DELAY);
	
	resetMessageInput();
	scrollBottom('#messages');
	scrollBottom('#tasks');
	renderTimes();
	refreshTimeagos();
	
	time_refresh_interval = window.setInterval(refreshTimeagos, TIME_REFRESH_DELAY);

	socket.on('error', function(message) { // message is an event object for some reason, not a string
		console.error(message);
		console.error('Error: Web socket disconnected');
		alert('Error: Web socket disconnected: ' + message);
		window.location.href = '/';
	});
	
	socket.on('membership_change', function(members) {
		room_members = members;
		$('#members').empty();
		
		for(var i=0; i<room_members.length; i++) {
			var curr_member = room_members[i];
			members_typing_cooldown[curr_member] = false;
			members_typing_flag[curr_member] = false;
			
			var htmlString = getMemberEntryHTML(curr_member, false);
			$('#members').append('<p id="member_' + curr_member + '" data-idle="false">' + htmlString + '</p>');
		}
	});
	
	socket.on('stc_typing', function(username) {
		if(!members_typing_cooldown[username]) {
			members_typing_cooldown[username] = true;
		}
		
		if(!members_typing_flag[username]) {
			addTypingNote(username);
			members_typing_flag[username] = true;
		}
	});
	
	socket.on('stc_user_idle', function(username) {
		var $member_entry = $('#member_' + username);
		var idle = $member_entry.data('idle');
		
		if(!idle) {
			$member_entry.data('idle', true);
			var htmlString = getMemberEntryHTML(username, true);
			$member_entry.empty();
			$member_entry.append(htmlString);
		}
	});
	
	socket.on('stc_user_active', function(username) {
		var $member_entry = $('#member_' + username);
		var idle = $member_entry.data('idle');
		
		if(idle) {
			$member_entry.data('idle', false);
			var htmlString = getMemberEntryHTML(username, false);
			$member_entry.empty();
			$member_entry.append(htmlString);
		}
	});
	
	$('#add_message_form').submit(function(event) {
		event.preventDefault();
		
		var $input_message = $('#input_message');
		
		if(!$input_message.val()) {
			return false;
		}
		
		sendMessage();
		
		resetMessageInput();
		
		return false;
	});
	
	$('#input_message').keypress(function(e) {
		if(e.which != 13) {
			var new_message_content = $('#input_message').val();
			socket.emit('cts_typing');
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

function sendMessage() {
	var $input_message = $('#input_message');

	var replyTo = $input_message.data('reply-target-message');
	var content = $input_message.val();
	
	var messageData = {
		'content': content,
		'reply': replyTo
	};
	
	socket.emit('cts_message', messageData);
	console.log('emitting');
	console.log(messageData);
	
	destroyReply();
	
	displayMessage(global_username, replyTo, content, (new Date().getTime() / 1000));
}

function initReply(messageLink) {
	var $message = $(messageLink).parent();
	var replyTargetMessage = $message.data('message-id');
	var replyTargetAuthor = $message.data('message-author');
	
	var $input_message = $('#input_message');
	$input_message.data('reply-target-message', replyTargetMessage);
	$input_message.data('reply-target-author', replyTargetAuthor);
	$input_message.popover('show');
}

function destroyReply() {
	var $input_message = $('#input_message');
	$input_message.data('reply-target-message', null);
	$input_message.data('reply-target-author', null);
	$input_message.popover('hide');
}

function resetMessageInput() {
	var $input_message = $('#input_message');
	$input_message.val('').trigger('autosize.resize');
}

function displayMessage(author, replyTo, content, time) {
	displayed_messages += 1;
	
	var htmlString = '<div class="message" data-msg-time="' + time + '">';
	htmlString += '<strong>' + author + ':</strong> <p>' + content + '</p></div>';
	$('#messages').append(htmlString);
	scrollBottom('#messages');
	
	while(displayed_messages > 500) { // if there are too many messages to display, start removing old messages
		$('#messages .message').first().remove();
		displayed_messages -= 1;
	}
}

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

function addTypingNote(username) {
	var htmlString = '<div class="message typing_notification" id="' + username + '_typing_notification" data-msg-time="' + -1 + '">';
	htmlString += '<p>' + username + ' is typing...</p></div>';
	$('#messages').append(htmlString);
	
	scrollBottom('#messages');
}

function removeTypingNote(username) {
	if(members_typing_flag[username]) {
		var note_id = '#' + username + '_typing_notification';
		$(note_id).remove();
		members_typing_flag[username] = false;
		
		scrollBottom('#messages');
	}
}

function getMemberEntryHTML(username, idle) {
	var htmlString = '';
	var idleContent = '';
	if(idle) {
		idleContent = ' (idle)';
	}
	
	htmlString = '<a class="member" data-member="' + username + '" href="#">' + username + idleContent + '</a>';
	
	return htmlString;
}

function renderTimes() {
	$('.task_detail').each(function(i, element) {
		var $task = $(element);
		var nice_time = moment.unix($task.data('task-time')).format('h:mma [on] MMM D, YYYY');
		$task.find('.task_time').text(nice_time);
	});
}

function refreshTimeagos() {
	$('.task').each(function(i, element) {
		var $task = $(element);
		var nice_time = moment.unix($task.data('task-time')).fromNow();
		$task.find('.task_timeago').text(nice_time);
	});
	
	$('.message').each(function(i, element) {
		var $message = $(element);
		var nice_time = moment.unix($message.data('message-time')).fromNow();
		$message.attr('title', nice_time);
	});
	
	$('[data-toggle="tooltip"]').tooltip({animation: false}); // enable bootstrap tooltips
}

function scrollBottom(element_id) {
	var $messages = $(element_id);
	$messages.scrollTop($messages.height()); // there is no scroll bottom, but this should do
}
