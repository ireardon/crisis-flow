// this file contains global config variables
var path = require('path');

module.exports.DEBUG = true;

// a secret string used to cryptographically sign cookies (this can be anything, just don't expose it)
module.exports.COOKIE_SIGN_SECRET = 'genericsecret';

// the name of the cookie stored in the user's browser which identifies the session
module.exports.COOKIE_SESSION_KEY = 'crisis_flow_session';

// the any-db identifier for your database backend
module.exports.DATA_DB_FILENAME = 'data.db';
module.exports.SESSION_DB_FILENAME = 'sessions.db';
module.exports.SESSION_DB_TABLENAME = 'sessions';

module.exports.WEB_UPLOAD_PATH = '/uploads/';
module.exports.LOCAL_UPLOAD_PATH = path.join(__base, '/uploads/');

// the length of the salt string used in hashing the user's password etc.
module.exports.SALT_LENGTH = 20;

module.exports.STATUS_SUBMITTED = 0;
module.exports.STATUS_IN_PROGRESS = 1;
module.exports.STATUS_IN_REVIEW = 2;
module.exports.STATUS_COMPLETED = 3;
module.exports.STATUS_CANCELLED = 4;

var statusMap = {};
statusMap[module.exports.STATUS_SUBMITTED] = 'Submitted';
statusMap[module.exports.STATUS_IN_PROGRESS] = 'In Progress';
statusMap[module.exports.STATUS_IN_REVIEW] = 'Completed by Crisis';
statusMap[module.exports.STATUS_COMPLETED] = 'Finished';
statusMap[module.exports.STATUS_CANCELLED] = 'Cancelled';
module.exports.STATUS_MAP = statusMap;

// the default number of most recent messages to display in a room
// if the user elects to view the message archive for a room, all messages are displayed
module.exports.DEFAULT_MESSAGE_COUNT = 100;
