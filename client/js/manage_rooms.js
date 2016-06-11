var actionRoom = null;
var actionChannel = null;

$(document).ready(function() {
	$('#new_room_form').submit(function(event) {
		event.preventDefault();
		
		var new_room_name = $('#new_room_name').val();
		if(!new_room_name) {
			return false;
		}
		
		var post_data = {
			'room_name': new_room_name
		};
		
		$.post('/create_room', post_data, function() {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
	
	$('.rename_room').on('click', function() {
		actionRoom = $(this).data('room-id');
	});
	
	$('.delete_room').on('click', function() {
		actionRoom = $(this).data('room-id');
	});
	
	$('.add_channel').on('click', function() {
		actionRoom = $(this).data('room-id');
	});
	
	$('.delete_channel').on('click', function() {
		actionChannel = $(this).data('channel-id');
	});
	
	$('.rename_channel').on('click', function() {
		actionChannel = $(this).data('channel-id');
	});
	
	$('#confirm_room_delete').on('click', function() {
		if(!actionRoom) {
			return false;
		}
	
		var post_data = {
			'room_id': actionRoom
		};
		
		$.post('/delete_room', post_data, function() {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
	
	$('#confirm_room_rename').on('click', function() {
		var roomName = $('#rename_room_name').val();
	
		if(!actionRoom || !roomName) {
			return false;
		}
		
		var post_data = {
			'room_id': actionRoom,
			'new_name': roomName
		};
		
		$.post('/rename_room', post_data, function() {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
	
	$('#create_new_channel').on('click', function() {
		var channelName = $('#new_channel_name').val();
	
		if(!actionRoom || !channelName) {
			return false;
		}
		
		var post_data = {
			'room_id': actionRoom,
			'channel_name': channelName
		};
		
		$.post('/create_channel', post_data, function() {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
	
	$('#confirm_channel_delete').on('click', function() {
		if(!actionChannel) {
			return false;
		}
		
		var post_data = {
			'channel_id': actionChannel
		};
		
		$.post('/delete_channel', post_data, function() {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
	
	$('#confirm_channel_rename').on('click', function() {
		var channelName = $('#rename_channel_name').val();
	
		if(!actionChannel || !channelName) {
			return false;
		}
		
		var post_data = {
			'channel_id': actionChannel,
			'channel_name': channelName
		};
		
		$.post('/rename_channel', post_data, function() {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
	
	$('.expand_channels').on('click', function() {
		var $channels = $(this).next('.channels_list');
		$channels.slideToggle(300);
	});
});