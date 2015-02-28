var SERVER_SALT;
var SALT_LENGTH;

$(document).ready(function() {
	SERVER_SALT = document.querySelector('meta[name=server_salt]').content;
	SALT_LENGTH = SERVER_SALT.length;

	$('#signup_form').submit(function(event) {
		event.preventDefault();
		
		var username_val = $('#username').val();
		var password_val = $('#password').val();
		var access_val = $('#access_code').val();
		var display_name_val = $('#display_name').val();
		
		var client_salt = getSaltBits();
		var hashed_password = CryptoJS.SHA256(password_val).toString(CryptoJS.enc.Hex);
		
		var hashed_access_code = hashAccessCode(access_val, client_salt, SERVER_SALT);
		
		var post_data = {
			'username': username_val,
			'client_salt': client_salt,
			'hashed_password': hashed_password,
			'access_code_salted_hash': hashed_access_code,
			'display_name': display_name_val
		};
		
		$.post('/signup', post_data, function(response) {
			if(response.error) {
				alert(response.error);
			} else {
				window.location.href = '/index';
			}
		});
		
		return false;
	});
});

function hashAccessCode(access_code, client_salt, server_salt) {
	var key = access_code + client_salt + server_salt;
	
	return CryptoJS.SHA256(key).toString(CryptoJS.enc.Hex);
}

function getSaltBits() {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

	var result = '';
	for (var i = 0; i < SALT_LENGTH; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));

	return result;
}