var TYPE_DELAY = 2000;
var displayed_messages = 0;
var room_members = [];
var members_typing_cooldown = {};
var members_typing_flag = {};
var glob_roomID, glob_username;
var typing_interval_id = -1;

$(document).ready(function() {
	glob_roomID = document.querySelector('meta[name=room_id]').content;
	glob_username = document.querySelector('meta[name=username]').content;
	socket.emit('join', glob_roomID, glob_username);
	
	typing_interval_id = window.setInterval(checkTyping, TYPE_DELAY);
	
	resetMessageInput();
	scrollBottom('#messages');
	scrollBottom('#tasks');
	refreshTimeagos();

	socket.on('error', function(message) { // message is an event object for some reason, not a string
		console.log(message);
		console.error('Error: Web socket disconnected: ', message);
		alert('Error: Web socket disconnected: ' + message);
		window.location.href = '/';
	});
	
	socket.on('stc_add_task', function(task_data) {
		console.log(task_data);
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
	
	socket.on('stc_message', function(username, message, time) {
		removeTypingNote(username);
		displayMessage(username, message, time);
	});
	
	socket.on('stc_whisper', function(username, message, time) {
		displayMessage(username + ' (whisper to you)', message, time);
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
		
		if(!$input_message.val())
			return false;
		
		if($input_message.data('whisper-to')) { // whisper
			sendWhisper();
		} else { // normal message
			sendMessage();
		}
		
		resetMessageInput();
		
		return false;
	});
	
	$('#input_message').keypress(function(e) {
		if(e.which != 13) {
			var new_message_content = $('#input_message').val();
			if(new_message_content[0] !== '@') { // ignore whispers
				socket.emit('cts_typing');
			}
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

	// user has switched away from current tab
	$(window).blur(function() {
		socket.emit('cts_user_idle');
	});
	
	// user has switched back to current tab
	$(window).focus(function() {
		socket.emit('cts_user_active');
	});
});

function sendWhisper(whisper_content) {
	var tokens = whisper_content.split(' ');
	var target_name = tokens[0].substring(1);
	
	if(target_name === glob_username) {
		$('#input_message').attr('placeholder', "No, curious cat. You can't whisper to yourself.");
		$('#input_message').val('');
		return false;
	}
	
	var valid = false;
	for(var i=0; i<room_members.length; i++) { // make sure the person we're trying to whisper to is in the room
		if(room_members[i] === target_name) {
			valid = true;
		}
	}
	
	if(!valid) {
		alert('You cannot send a private message to "' + target_name + '" because he or she is not in this room!');
		return false;
	}
	
	var trunc_msg_content = whisper_content.substring(target_name.length + 2);
	
	socket.emit('cts_whisper', target_name, trunc_msg_content);
	displayMessage(glob_username + ' (whisper to ' + target_name + ')', trunc_msg_content, (new Date().getTime() / 1000));
}

function sendMessage() {
	var $input_message = $('#input_message');

	var reply_to = $input_message.data('reply-to');
	var content = $input_message.val();
	
	var msg_data = {
		'msg_content': content,
		'msg_reply_to': reply_to
	};
	
	socket.emit('cts_message', msg_data);
	displayMessage(glob_username, reply_to, content, (new Date().getTime() / 1000));
}

function initWhisper(member) {
	var $input_message = $('#input_message');
	var member_name = $(member).data('member');
	
	$input_message.data('whisper-to', member_name);
	$input_message.val('@' + member_name + ' ');
	$input_message.focus();
}

function resetMessageInput() {
	var $input_message = $('#input_message');
	$input_message.data('reply-to', null);
	$input_message.data('whisper-to', null);
	$input_message.val('');
}

function displayMessage(author, reply_to, content, time) {
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
	
	if(username === glob_username) { // shouldn't be able to whisper to yourself
		htmlString = username + idleContent;
	} else {
		htmlString = '<a class="member" data-member="' + username + '" onclick="initWhisper(this);" href="#">' + username + idleContent + '</a>';
	}
	
	return htmlString;
}

function refreshTimeagos() {
	$('.task').each(function(i, element) {
		var $task = $(element);
		var nice_time = moment.unix($task.data('task-time')).fromNow();
		$task.find('.task_timeago').text(nice_time);
	});
	
	$('.message').each(function(i, element) {
		var $msg = $(element);
		var nice_time = moment.unix($msg.data('msg-time')).fromNow();
		$msg.find('.msg_timeago').text(nice_time);
	});
}

function scrollBottom(element_id) {
	var $messages = $(element_id);
	$messages.scrollTop($messages.height()); // there is no scroll bottom, but this should do
}
