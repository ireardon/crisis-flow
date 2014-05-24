var SERVER_SALT;
var SALT_LENGTH;

$(document).ready(function() {
	SERVER_SALT = document.querySelector('meta[name=server_salt]').content;
	console.log(SERVER_SALT);
	SALT_LENGTH = SERVER_SALT.length;
	console.log(SALT_LENGTH);

	$('#signin_form').submit(function(event) {
		event.preventDefault();
		
		var username_val = $('#username').val();
		var password_val = $('#password').val();
		
		console.log(password_val);
		
		var client_salt = getSaltBits();
		console.log(client_salt);
		var hashed_password = hashPassword(password_val, client_salt, SERVER_SALT).toString(CryptoJS.enc.Hex);
		console.log(hashed_password);
		
		var post_data = {
			'username': username_val,
			'client_salt': client_salt,
			'client_salted_hash': client_salted_hash
		};
		
		$.post('/signin/', post_data, function(error) {
			//window.location.href = '/index';
		});
		
		return false;
	});
});

function hashPassword(raw_password, client_salt, server_salt) {
	var hashed_password = CryptoJS.SHA256(raw_password);
	var key = hashed_password + client_salt + server_salt;
	
	return CryptoJS.SHA256(key);
}

function getSaltBits() {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

	var result = '';
	for (var i = 0; i < SALT_LENGTH; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));

	return result;
}