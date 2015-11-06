var locals = require(__localModules);
var config = require(locals.CONFIG);

module.exports = {
	'error': error,
	'debug': debug
};

function error(err, message) {
	if(err) {
		console.error('ERROR: ' + message);
		console.error(err);
		console.error(err.stack);
	}
}

function debug(message) {
	if(config.DEBUG) {
		console.log(message);
	}
}
