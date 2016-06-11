var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function Users() {
        return {
            'create': createUser,
            'get': getUser,
            'getWithPassword': getUserWithPassword,
            'getAll': getUsersDictionary
        };
    }

    function createUser(username, password_hash, role, display_name, callback) {
    	var sql = 'INSERT INTO users(username, password_hash, role, display_name) VALUES($username, $password_hash, $role, $display_name)';
    	report.debug(sql);

    	dataConn.run(sql, {
    		$username: username,
    		$password_hash: password_hash,
    		$role: role,
    		$display_name: display_name
    	},
    	function(error) {
    		report.error(error, 'Users.createUser failed');

    		if(utils.validCallback(callback)) {
    			callback(error);
    		}
    	});
    }

    function getUser(username, callback) {
    	var sql = 'SELECT username, role, display_name FROM users WHERE username = $username';
    	dataConn.get(sql, {$username: username}, function(error, row) {
    		report.error(error, 'Users.getUser failed');

    		if(!row && !error) {
    			error = 'Record not found';
    		}

    		if (utils.validCallback(callback)) {
    			callback(error, row);
    		}
    	});
    }

    function getUserWithPassword(username, callback) {
    	var sql = 'SELECT username, password_hash, role, display_name FROM users WHERE username = $username';
    	dataConn.get(sql, {$username: username}, function(error, row) {
    		report.error(error, 'Users.getUser failed');

    		if(!row && !error) {
    			error = 'Record not found';
    		}

    		if (utils.validCallback(callback)) {
    			callback(error, row);
    		}
    	});
    }

    function getUsersDictionary(callback) {
    	var sql = 'SELECT username, role, display_name FROM users ORDER BY username ASC';
    	dataConn.all(sql, {}, function(error, rows) {
    		report.error(error, 'Users.getUsersDictionary failed');

    		if(error) {
    			callback(error);
    			return;
    		}

    		var dict = {};
    		for(var i=0; i<rows.length; i++) {
    			var user = rows[i];
    			dict[user.username] = user;
    		}

    		if (utils.validCallback(callback)) {
    			callback(error, dict);
    		}
    	});
    }

    return new Users();
};
