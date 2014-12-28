// this file contains global settings variables

// a secret string used to cryptographically sign cookies (this can be anything, just don't expose it)
var COOKIE_SIGN_SECRET = 'genericsecret';

// the name of the cookie stored in the user's browser which identifies the session
var COOKIE_SESSION_KEY = 'crisis_flow_session';

// the any-db identifier for your database backend
var DATA_ANYDB_CONNECT_ID = 'sqlite3://chatroom.db';

var SESSION_ANYDB_CONNECT_ID = 'sqlite3://sessions.db';

var SESSION_DB_TABLENAME = 'sessions';

// the length of the salt string used in hashing the user's password etc.
var SALT_LENGTH = 20;

// the length of unique room identifier strings
var ROOM_ID_LENGTH = 6;

// the default number of most recent messages to display in a room
// if the user elects to view the message archive for a room, all messages are displayed
var DEFAULT_MESSAGE_COUNT = 50;

module.exports = {
	'COOKIE_SIGN_SECRET': COOKIE_SIGN_SECRET,
	'COOKIE_SESSION_KEY': COOKIE_SESSION_KEY,
	'DATA_ANYDB_CONNECT_ID': DATA_ANYDB_CONNECT_ID,
	'SESSION_ANYDB_CONNECT_ID': SESSION_ANYDB_CONNECT_ID,
	'SESSION_DB_TABLENAME': SESSION_DB_TABLENAME,
	'SALT_LENGTH': SALT_LENGTH,
	'ROOM_ID_LENGTH': ROOM_ID_LENGTH,
	'DEFAULT_MESSAGE_COUNT': DEFAULT_MESSAGE_COUNT
};