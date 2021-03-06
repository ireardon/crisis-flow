var locals = require(__localModules);
var report = require(locals.lib.report);

/*
	This module contains easy-to-use functions for sending error responses to
	clients.
*/

module.exports = {
	'send404': send404,
    'send500': send500,
	'reportRequest': reportRequest
};

// Issues a 404 not found error response in a client-friendly format
function send404(request, response) {
	report.debug('ISSUED 404 for URL: ' + request.url);

	response.status(404);

	if (request.accepts('html')) {
		var context = { url: request.url };

		if(request.session.user) {
			context.username = request.session.user.username;
		}

		response.render('404.html', context);
		return;
	}

	if (request.accepts('json')) {
		response.send({ error: '404 - Not found' });
		return;
	}

	response.type('txt').send('404 - Not found');
}

// Issues a 500 internal server error response in a client-friendly format
function send500(error, request, response, next) {
	report.error(error, 'ISSUED 500 for URL: ' + request.url);

	response.status(error.status || 500);

	if (request.accepts('html')) {
		var context = {};
		if(request.session.user) {
			context.username = request.session.user.username;
		}

		response.render('500.html', context);
		return;
	}

	if (request.accepts('json')) {
		response.send({ error: '500 - Internal server error' });
		return;
	}

	response.type('txt').send('500 - Internal server error');
}

function reportRequest(request) {
	report.debug(request.method + ' ' + request.originalUrl);
}
