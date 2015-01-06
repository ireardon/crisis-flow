// this file contains global config variables

// a secret string used to cryptographically sign cookies (this can be anything, just don't expose it)
var COOKIE_SIGN_SECRET = 'genericsecret';

// the name of the cookie stored in the user's browser which identifies the session
var COOKIE_SESSION_KEY = 'crisis_flow_session';

// the any-db identifier for your database backend
var DATA_DB_FILENAME = 'data.db';

var SESSION_DB_FILENAME = 'sessions.db';

var SESSION_DB_TABLENAME = 'sessions';

var UPLOAD_PATH = '/uploads/';

// the length of the salt string used in hashing the user's password etc.
var SALT_LENGTH = 20;

var STATUS_SUBMITTED = 0;
var STATUS_RECEIVED = 1;
var STATUS_IN_PROGRESS = 2;
var STATUS_COMPLETED = 3;

// the default number of most recent messages to display in a room
// if the user elects to view the message archive for a room, all messages are displayed
var DEFAULT_MESSAGE_COUNT = 50;

module.exports = {
	'COOKIE_SIGN_SECRET': COOKIE_SIGN_SECRET,
	'COOKIE_SESSION_KEY': COOKIE_SESSION_KEY,
	'DATA_DB_FILENAME': DATA_DB_FILENAME,
	'SESSION_DB_FILENAME': SESSION_DB_FILENAME,
	'SESSION_DB_TABLENAME': SESSION_DB_TABLENAME,
	'UPLOAD_PATH': UPLOAD_PATH,
	'SALT_LENGTH': SALT_LENGTH,
	'DEFAULT_MESSAGE_COUNT': DEFAULT_MESSAGE_COUNT,
	'STATUS_SUBMITTED': STATUS_SUBMITTED,
	'STATUS_RECEIVED': STATUS_RECEIVED,
	'STATUS_IN_PROGRESS': STATUS_IN_PROGRESS,
	'STATUS_COMPLETED': STATUS_COMPLETED
};