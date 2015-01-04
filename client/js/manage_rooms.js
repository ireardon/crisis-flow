var deleteRoom = null;
var renameRoom = null;

$(document).ready(function() {
	$('#new_room_form').submit(function(event) {
		event.preventDefault();
		
		var new_room_name = $('#new_room_name').val();
		if(!new_room_name)
			return false;
		var post_data = {
			'room_name': new_room_name
		};
		
		console.log(post_data);
		$.post('/create_room', post_data, function(roomID) {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
	
	$('.rename_room').on('click', function() {
		renameRoom = $(this).data('room-id');
	});
	
	$('.delete_room').on('click', function() {
		deleteRoom = $(this).data('room-id');
	});
	
	$('#confirm_room_delete').on('click', function() {
		if(!deleteRoom) {
			return false;
		}
	
		var post_data = {
			'room_id': deleteRoom
		};
		
		$.post('/delete_room', post_data, function() {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
	
	$('#confirm_room_rename').on('click', function() {
		if(!renameRoom) {
			return false;
		}
		
		var post_data = {
			'room_id': renameRoom,
			'new_name': $('#rename_room_name').val()
		};
		
		$.post('/rename_room', post_data, function() {
			window.location.href = '/manage_rooms';
		});
		
		return false;
	});
});