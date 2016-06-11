var crypto = require('crypto');

var locals = require(__localModules);
var config = require(locals.config);
var report = require(locals.lib.report);

/*
	This module contains miscellaneous security-related functions used throughout
	the server code.
*/

module.exports = {
	'sessionValid': sessionValid,
	'verifyPasswordHash': verifyPasswordHash,
	'getAccessRole': getAccessRole,
	'validStatus': validStatus,
	'getSaltBits': getSaltBits
};

// Returns true if the session is still active, false otherwise
function sessionValid(session) {
	if(!session || !session.active) {
		return false;
	}

	return true;
}

// Returns true if the salted password hash from the client is correct, false otherwise
function verifyPasswordHash(user, client_salted_hash, client_salt, server_salt) {
	var key = user.password_hash + client_salt + server_salt;
	var server_salted_hash = crypto.createHash('sha256').update(key).digest('hex');

	return client_salted_hash === server_salted_hash;
}

// Returns the index of the access role corresponding to the access code hash
// retrieved from the client
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

// Returns the status string corresponding to the given status (truthy) if the
// status exists, undefined otherwise (falsy)
function validStatus(status) {
	return config.STATUS_MAP[status];
}

// Get a randomized string to use as salt bits
function getSaltBits() {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

	var result = '';
	for (var i = 0; i < config.SALT_LENGTH; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));

	return result;
}
