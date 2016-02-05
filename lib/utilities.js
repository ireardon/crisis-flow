module.exports.validCallback = function(callback) {
	return callback && typeof(callback) === 'function';
}

module.exports.getMillisecondTime = function() {
	return new Date().getTime() / 1000;
}
