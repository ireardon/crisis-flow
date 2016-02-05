var path = require('path');

module.exports = {
    config: path.join(__dirname, 'config'),
    lib: {
        ClientDirectory: path.join(__dirname, 'lib', 'ClientDirectory'),
        getcookie: path.join(__dirname, 'lib', 'getcookie'),
        report: path.join(__dirname, 'lib', 'report')
    },
    server: {
        security: path.join(__dirname, 'server', 'security'),
        error: path.join(__dirname, 'server', 'error'),
        database: {
            dbops: path.join(__dirname, 'server', 'database', 'database_ops')
        },
        routes: {
            ajax: path.join(__dirname, 'server', 'routes', 'ajaxRoutes'),
            page: path.join(__dirname, 'server', 'routes', 'pageRoutes')
        }
    }
}
