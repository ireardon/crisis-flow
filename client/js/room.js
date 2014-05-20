var TYPE_DELAY = 2000;
var displayed_messages = 0;
var room_members = [];
var members_typing_cooldown = {};
var members_typing_flag = {};
var glob_roomID, glob_nickname;
var typing_interval_id = -1;

$(document).ready(function() {
	glob_roomID = document.querySelector('meta[name=room_id]').content;
	glob_nickname = document.querySelector('meta[name=nickname]').content;
	socket.emit('join', glob_roomID, glob_nickname);
	
	typing_interval_id = window.setInterval(checkTyping, TYPE_DELAY);
	
	$('#messages').scrollTop(99999); // there is no scroll bottom, but this should do

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
	
	socket.on('stc_message', function(nickname, message, time) {
		removeTypingNote(nickname);
		displayMessage(nickname, message, time);
	});
	
	socket.on('stc_whisper', function(nickname, message, time) {
		displayMessage(nickname + ' (whisper to you)', message, time);
	});
	
	socket.on('stc_typing', function(nickname) {
		if(!members_typing_cooldown[nickname]) {
			members_typing_cooldown[nickname] = true;
		}
		
		if(!members_typing_flag[nickname]) {
			addTypingNote(nickname);
			members_typing_flag[nickname] = true;
		}
	});
	
	socket.on('stc_user_idle', function(nickname) {
		var $member_entry = $('#member_' + nickname);
		var idle = $member_entry.data('idle');
		
		if(!idle) {
			$member_entry.data('idle', true);
			var htmlString = getMemberEntryHTML(nickname, true);
			$member_entry.empty();
			$member_entry.append(htmlString);
		}
	});
	
	socket.on('stc_user_active', function(nickname) {
		var $member_entry = $('#member_' + nickname);
		var idle = $member_entry.data('idle');
		
		if(idle) {
			$member_entry.data('idle', false);
			var htmlString = getMemberEntryHTML(nickname, false);
			$member_entry.empty();
			$member_entry.append(htmlString);
		}
	});
	
	$('#add_message_form').submit(function(event) {
		event.preventDefault();
		
		var new_message_content = $('#input_message').val();
		if(!new_message_content)
			return false;
		
		if(new_message_content[0] === '@') { // whisper
			var tokens = new_message_content.split(' ');
			var target_name = tokens[0].substring(1);
			
			if(target_name === glob_nickname) {
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
			
			var trunc_msg_content = new_message_content.substring(target_name.length + 2);
			
			socket.emit('cts_whisper', target_name, trunc_msg_content);
			displayMessage(glob_nickname + ' (whisper to ' + target_name + ')', trunc_msg_content, (new Date().getTime() / 1000));
		} else { // normal message
			socket.emit('cts_message', new_message_content);
			displayMessage(glob_nickname, new_message_content, (new Date().getTime() / 1000));
		}
		
		$('#input_message').val('');
		
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
			'queue': false/*,
			'done': function() {
				return;
			}*/
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
			'duration': 400/*,
			'done': function() {
				return;
			}*/
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

function initWhisper(member) {
	var $member = $(member);
	var member_name = $member.data('member');
	
	$('#input_message').val('@' + member_name + ' ');
	$('#input_message').focus();
}

function displayMessage(poster, text, time) {
	displayed_messages += 1;
	
	var htmlString = '<div class="message" data-msg-time="' + time + '">';
	htmlString += '<strong>' + poster + ':</strong> <p>' + text + '</p></div>';
	$('#messages').append(htmlString);
	$('#messages').scrollTop(99999); // there is no scroll bottom, but this should do
	
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

function addTypingNote(nickname) {
	var htmlString = '<div class="message typing_notification" id="' + nickname + '_typing_notification" data-msg-time="' + -1 + '">';
	htmlString += '<p>' + nickname + ' is typing...</p></div>';
	$('#messages').append(htmlString);
	
	$('#messages').scrollTop(99999); // there is no scroll bottom, but this should do
}

function removeTypingNote(nickname) {
	if(members_typing_flag[nickname]) {
		var note_id = '#' + nickname + '_typing_notification';
		$(note_id).remove();
		members_typing_flag[nickname] = false;
		
		$('#messages').scrollTop(99999); // there is no scroll bottom, but this should do
	}
}

function getMemberEntryHTML(nickname, idle) {
	var htmlString = '';
	var idleContent = '';
	if(idle) {
		idleContent = ' (idle)';
	}
	
	if(nickname === glob_nickname) { // shouldn't be able to whisper to yourself
		htmlString = nickname + idleContent;
	} else {
		htmlString = '<a class="member" data-member="' + nickname + '" onclick="initWhisper(this);" href="#">' + nickname + idleContent + '</a>';
	}
	
	return htmlString;
}
