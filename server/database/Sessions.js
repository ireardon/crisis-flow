var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(sessionStoreConnection) {
    this.sessionConn = sessionStoreConnection;

    function Sessions() {
        return {
            'get': getSessionRecord
        };
    }

    function getSessionRecord(sessionKey, callback) {
    	var sql = 'SELECT * FROM sessions WHERE sid = $sessionKey';
    	sessionConn.get(sql, {$sessionKey: sessionKey}, function(error, row) {
    		report.error(error, 'Sessions.getSessionRecord failed');

    		if(!row && !error) {
    			error = 'Record not found';
    		}

    		if (utils.validCallback(callback)) {
    			callback(error, row);
    		}
    	});
    }

    return new Sessions();
};
