// this module contains the functions for all database access
var sqlite3 = require('sqlite3').verbose();
var moment = require('moment');

var assert = require('assert'); // TODO

var locals = require(__localModules);
var config = require(locals.config);
var report = require(locals.lib.report);

var dataConn = new sqlite3.Database(config.DATA_DB_FILENAME, sqlite3.OPEN_READWRITE);
var sessionConn = new sqlite3.Database(config.SESSION_DB_FILENAME, sqlite3.OPEN_READWRITE);


/*###################################
  #       INSERTION FUNCTIONS       #
  ###################################*/


/*###################################
  #       RETRIEVAL FUNCTIONS       #
  ###################################*/



/*###################################
  #         UPDATE FUNCTIONS        #
  ###################################*/




/*###################################
  #        REMOVAL FUNCTIONS        #
  ###################################*/




/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/



function databaseCleanup() {
	dataConn.close();
	sessionConn.close();
}
