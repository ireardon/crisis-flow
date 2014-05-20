$(document).ready(function() {
	$('#nickname_form').submit(function(event) {
		event.preventDefault();
		
		var nickname_val = $('#nickname').val();
		
		$.get('/signin/' + nickname_val, function() {
			window.location.href = '/index';
		});
		
		return false;
	});
});