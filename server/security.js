var crypto = require('crypto');

var locals = require(__localModules);
var config = require(locals.config);
var report = require(locals.lib.report);

module.exports = {
	'sessionValid': sessionValid,
	'verifyPasswordHash': verifyPasswordHash,
	'getAccessRole': getAccessRole,
	'validStatus': validStatus,
	'getSaltBits': getSaltBits
};

function sessionValid(session) {
	if(!session || !session.active) {
		return false;
	}

	return true;
}

function verifyPasswordHash(user, client_salted_hash, client_salt, server_salt) {
	var key = user.password_hash + client_salt + server_salt;
	var server_salted_hash = crypto.createHash('sha256').update(key).digest('hex');

	return client_salted_hash === server_salted_hash;
}

function getAccessRole(access_code_salted_hash, client_salt, server_salt) {
	var access_roles = ['admin', 'producer', 'consumer'];

	for(var i=0; i<access_roles.length; i++) {
		var key = access_roles[i] + client_salt + server_salt;
		var role_code_salted_hash = crypto.createHash('sha256').update(key).digest('hex');

		if(access_code_salted_hash === role_code_salted_hash) {
			return i + 1;
		}
	}

	return 0;
}

function validStatus(status) {
	return config.STATUS_MAP[status];
}

function getSaltBits() {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

	var result = '';
	for (var i = 0; i < config.SALT_LENGTH; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));

	return result;
}
