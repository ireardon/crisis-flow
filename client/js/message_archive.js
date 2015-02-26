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
			url: '/rooms/' + global_roomID + '/archive/messages.json',
			dataType: 'json',
			success: function(data) {
				$scope.username = data.username;
				$scope.room = data.room;
				$scope.messages = data.messages;
				
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
		
		$scope.getReplyTargetAuthorDisplayName = function(replyTargetID) {
			var replyTarget = getEntryByID($scope.messages, replyTargetID);
			return replyTarget.authorDisplayName;
		};
		
		$scope.jumpToReplyTarget = function(replyTargetID) {
			var extra = 10; // scroll slightly above the actual top of the message
			
			var $messages = $('#messages');
			var $targetElement = $('#message_' + replyTargetID);
			var messagesScrollPosition = $messages.scrollTop();
			var targetElementTop = $targetElement.position().top;
			var messagesTop = $messages.offset().top;
			
			var topDifference = messagesTop - targetElementTop;
			var newScrollPosition = messagesScrollPosition - topDifference - extra;
			
			$messages.animate({ scrollTop: newScrollPosition }, { // scroll message window to reply target
				duration: 400, 
				complete: function() { // animate a growing box shadow to indicate which message is the target
					$targetElement.css('box-shadow', 'inset 0 0 9px 0 #03ffc1');
					$targetElement.animate({ boxShadow: 'inset 0 0 9px 6px #03ffc1' }, {
						duration: 500, 
						complete: function() { // animate the shrinking of the box shadow
							$targetElement.animate({ boxShadow: 'inset 0 0 9px 0 #03ffc1' }, {
								duration: 500,
								complete: function() { // remove the box shadow after the animation completes
									$targetElement.css('box-shadow', 'none');
								}
							});
						}
					});
				}
			});
		};
		
		/*###################################
		  #        SOCKET.IO HANDLERS       #
		  ###################################*/
		// these functions respond to websocket messages received from the server
		
		socket.on('error', function(message) { // message is an event object for some reason, not a string
			console.error(message);
			console.error('Error: Web socket disconnected');
			alert('Error: Web socket disconnected!');
			window.location.href = '/';
		});
		
		socket.on('stc_message', function(newMessage) {
			console.log(newMessage);
			
			$scope.messages.push(newMessage);
			var atBottom = scrolledToBottom('#messages');
			$scope.$apply();
			
			if(atBottom) {
				scrollBottom('#messages');
			}
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
	scrollBottom('#messages');
	
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
