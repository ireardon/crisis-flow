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
			window.location.href = '/rooms/' + roomID;
		});
		
		return false;
	});
});