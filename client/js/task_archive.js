var TIME_REFRESH_DELAY = 15000;
var global_roomID, global_username;
var timeRefreshInterval = -1;

var angularApp = angular.module('room', []);

angularApp.controller('ContextController', ['$scope', function($scope) {
	angular.element(document).ready(function() {
		// these two variables are embedded in meta tags by server templating
		global_roomID = document.querySelector('meta[name=room_id]').content;
		global_username = document.querySelector('meta[name=username]').content;
	
		jQuery.ajax({
			type: 'GET',
			url: '/rooms/' + global_roomID + '/archive/tasks.json',
			dataType: 'json',
			success: function(data) {
				$scope.username = data.username;
				$scope.room = data.room;
				$scope.tasks = data.tasks;
				$scope.statusStrings = data.statusMap;
				
				$scope.$apply();
			
				socket.emit('join', $scope.room.id, $scope.username);
				
				initializePage();
			}
		});
		
		/*###################################
		  #        ANGULAR FUNCTIONS        #
		  ###################################*/
		// these functions, attached to the controller's $scope, are invoked by Angular
		// directives in the HTML
		
		$scope.formatTaskTime = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var niceTime = moment.unix(task.time).format('h:mma [on] MMM D, YYYY');
			return niceTime;
		};
		
		$scope.advanceTaskStatus = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var currentStatus = task.status;
			var newStatus = currentStatus + 1;
			
			socket.emit('cts_task_status_changed', taskID, currentStatus, newStatus);
			task.status = newStatus;
		};
		
		$scope.retreatTaskStatus = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var currentStatus = task.status;
			var newStatus = currentStatus - 1;
			
			socket.emit('cts_task_status_changed', taskID, currentStatus, newStatus);
			task.status = newStatus;
		};
		
		/*###################################
		  #        SOCKET.IO HANDLERS       #
		  ###################################*/
		// these functions respond to websocket messages received from the server
		
		socket.on('error', function(message) { // message is an event object for some reason, not a string
			console.error(message);
			console.error('Error: Web socket disconnected');
			alert('Error: Web socket disconnected: ' + message);
			window.location.href = '/';
		});
		
		socket.on('stc_add_task', function(newTask) {
			$scope.tasks.push(newTask);
			$scope.$apply();
			
			scrollBottom('#tasks');
		});
		
		/*###################################
		  #         jQUERY HANDLERS         #
		  ###################################*/
		// these are to handle more complex DOM behavior Angular isn't well suited to
		
		// user has switched away from current tab
		$(window).blur(function() {
			socket.emit('cts_user_idle');
		});
		
		// user has switched back to current tab
		$(window).focus(function() {
			socket.emit('cts_user_active');
		});
	});
}]);

/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/

// some initialization actions that occur only once when the page is loaded
function initializePage() {
	scrollBottom('#tasks');
	
	refreshTimeagos();
	timeRefreshInterval = window.setInterval(refreshTimeagos, TIME_REFRESH_DELAY);
}
  
function getEntryByID(list, id) {
	var entry = false;
	list.forEach(function(element) {
		if(element.id === id) {
			entry = element;
		}
	});
	
	return entry;
}

function getUserByUsername(list, username) {
	var user = false;
	list.forEach(function(element) {
		if(element.username === username) {
			user = element;
		}
	});
	
	return user;
}

function refreshTimeagos() {
	$('.task').each(function(i, element) {
		var $task = $(element);
		var niceTime = moment.unix($task.data('task-time')).fromNow();
		$task.attr('title', niceTime);
	});
	
	$('.message').each(function(i, element) {
		var $message = $(element);
		var niceTime = moment.unix($message.data('message-time')).fromNow();
		$message.attr('title', niceTime);
	});
	
	$('[data-toggle="tooltip"]').tooltip({animation: false, container: 'body'}); // enable bootstrap tooltips
	$('[title]').removeAttr('title'); // prevent browser-default tooltips from displaying
}

function scrolledToBottom(elementID) {
	var element = $(elementID).get(0);
	return (element.scrollHeight - element.scrollTop) <= (element.clientHeight + 20);
}

function scrollBottom(elementID) {
	var $display = $(elementID);
	// there is no scroll bottom, but this should do
	// we must use the DOM scrollHeight attribute, as the height
	// attribute accessible through jQuery measures only the visible portion
	$display.scrollTop($display.get(0).scrollHeight + 1);
}

function getMillisecondTime() {
	return new Date().getTime() / 1000;
}
