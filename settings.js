// this file contains global settings variables
var COOKIE_SIGN_SECRET = 'genericsecret';
var COOKIE_SESSION_KEY = 'crisis_flow_session';

var ANYDB_CONNECT_ID = 'sqlite3://chatroom.db';

var SALT_LENGTH = 20;
var ROOM_ID_LENGTH = 6;

module.exports = {
	'COOKIE_SIGN_SECRET': COOKIE_SIGN_SECRET,
	'COOKIE_SESSION_KEY': COOKIE_SESSION_KEY,
	'ANYDB_CONNECT_ID': ANYDB_CONNECT_ID,
	'SALT_LENGTH': SALT_LENGTH,
	'ROOM_ID_LENGTH': ROOM_ID_LENGTH
};