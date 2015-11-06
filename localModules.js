var path = require('path');

module.exports.CONFIG = path.join(__dirname, 'config');
module.exports.DBOPS = path.join(__dirname, 'lib', 'database_ops');
module.exports.GETCOOKIE = path.join(__dirname, 'lib', 'getcookie');
module.exports.CLIENTDIRECTORY = path.join(__dirname, 'lib', 'ClientDirectory');
module.exports.REPORT = path.join(__dirname, 'lib', 'report');
module.exports.HELPERS = path.join(__dirname, 'lib', 'helpers');
