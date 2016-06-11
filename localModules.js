var path = require('path');

module.exports = {
    config: path.join(__dirname, 'config'),
    lib: {
        ClientDirectory: path.join(__dirname, 'lib', 'ClientDirectory'),
        getcookie: path.join(__dirname, 'lib', 'getcookie'),
        report: path.join(__dirname, 'lib', 'report'),
        utilities: path.join(__dirname, 'lib', 'utilities')
    },
    server: {
        security: path.join(__dirname, 'server', 'security'),
        error: path.join(__dirname, 'server', 'error'),
        database: {
            Attachments: path.join(__dirname, 'server', 'database', 'Attachments'),
            Channels: path.join(__dirname, 'server', 'database', 'Channels'),
            Messages: path.join(__dirname, 'server', 'database', 'Messages'),
            Rooms: path.join(__dirname, 'server', 'database', 'Rooms'),
            Sessions: path.join(__dirname, 'server', 'database', 'Sessions'),
            Tags: path.join(__dirname, 'server', 'database', 'Tags'),
            TaskAttachments: path.join(__dirname, 'server', 'database', 'TaskAttachments'),
            TaskFollowups: path.join(__dirname, 'server', 'database', 'TaskFollowups'),
            Tasks: path.join(__dirname, 'server', 'database', 'Tasks'),
            TaskTags: path.join(__dirname, 'server', 'database', 'TaskTags'),
            Users: path.join(__dirname, 'server', 'database', 'Users')
        },
        routes: {
            ajax: path.join(__dirname, 'server', 'routes', 'ajaxRoutes'),
            page: path.join(__dirname, 'server', 'routes', 'pageRoutes')
        },
        Sockets: path.join(__dirname, 'server', 'Sockets')
    }
}
