var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function Attachments() {
        return {
            'create': createAttachment,
            'getByFilename': getAttachmentByFilename
        };
    }

    function createAttachment(file, callback) {
    	var sql = 'INSERT INTO attachments(user_filename, internal_filename) VALUES($user, $internal)';
    	dataConn.run(sql, {
    		$user: file.originalname,
    		$internal: file.name
    	}, function(error) {
    		report.error(error, 'Attachments.createAttachment failed');

    		if(utils.validCallback(callback)) {
    			callback(error, this.lastID);
    		}
    	});
    }

    function getAttachmentByFilename(internalFilename, callback) {
    	var sql = 'SELECT user_filename FROM attachments WHERE internal_filename = $internalFilename';
    	dataConn.get(sql, {$internalFilename: internalFilename}, function(error, row) {
    		report.error(error, 'Attachments.getAttachmentByFilename failed');

    		if(utils.validCallback(callback)) {
    			callback(error, row.user_filename);
    		}
    	});
    }

    return new Attachments();
};
