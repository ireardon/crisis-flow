var TIME_REFRESH_DELAY = 15000;
var members_typing_cooldown = {};
var members_typing_flag = {};
var global_roomID, global_username;
var global_joinedOnce = false;
var typing_interval_id = -1;
var timeRefreshInterval = -1;
var destroyReply;

var angularApp = angular.module('room', []);

angularApp.controller('ContextController', ['$scope', function($scope) {
	angular.element(document).ready(function() {
		// these two variables are embedded in meta tags by server templating
		global_roomID = document.querySelector('meta[name=room_id]').content;
		global_username = document.querySelector('meta[name=username]').content;
	
		jQuery.ajax({
			type: 'GET',
			url: '/rooms/' + global_roomID + '/data.json',
			dataType: 'json',
			success: function(data) {
				$scope.username = data.username;
				$scope.displayName = data.displayName;
				$scope.room = data.room;
				$scope.tasks = data.tasks;
				$scope.messages = data.messages;
				$scope.statusStrings = data.statusMap;
				$scope.replyTargetMessage = -1;
				$scope.replyTargetAuthorDisplayName = -1;
				$scope.audioEnabled = false;
				
				$scope.members = data.members.map(function(member) {
					member.idle = false;
					return member;
				});
				$scope.members.push({
					username: $scope.username,
					display_name: $scope.displayName,
					idle: false
				});
				
				$scope.minimumTaskStatus = 0;
				$scope.maximumTaskStatus = 1;
				
				$scope.$apply();
			
				socket.emit('join', $scope.room.id, $scope.username);
				global_joinedOnce = true;
				
				initializePage();
			}
		});
		
		/*###################################
		  #        ANGULAR FUNCTIONS        #
		  ###################################*/
		// these functions, attached to the controller's $scope, are invoked by Angular
		// directives in the HTML
		
		$scope.enterInputMessage = function($event) {
			if($event.charCode === 13 && $event.shiftKey === false) { // this was an 'enter' keypress
				$event.preventDefault();
				$scope.addMessage();
			}
		};
		
		$scope.initReply = function(messageID) {
			var message = getEntryByID($scope.messages, messageID);
			$scope.replyTargetMessage = messageID;
			$scope.replyTargetAuthorDisplayName = getReplyTargetAuthorDisplayName(messageID);
			
			$('#input_message').data('reply-target-author', $scope.replyTargetAuthorDisplayName);
			$('#input_message').popover('show');
		};
		
		$scope.displayCrisisTasks = function() {
			$scope.minimumTaskStatus = 0;
			$scope.maximumTaskStatus = 1;
			
			$('#crisis_tasks').addClass('tab-selected');
			$('#committee_tasks').removeClass('tab-selected');
			$('#archived_tasks').removeClass('tab-selected');
			
			refreshTimeagos();
		};
		
		$scope.displayCommitteeTasks = function() {
			$scope.minimumTaskStatus = 2;
			$scope.maximumTaskStatus = 2;
			
			$('#crisis_tasks').removeClass('tab-selected');
			$('#committee_tasks').addClass('tab-selected');
			$('#archived_tasks').removeClass('tab-selected');
			
			refreshTimeagos();
		};
		
		$scope.displayArchivedTasks = function() {
			$scope.minimumTaskStatus = 3;
			$scope.maximumTaskStatus = 4;
			
			$('#crisis_tasks').removeClass('tab-selected');
			$('#committee_tasks').removeClass('tab-selected');
			$('#archived_tasks').addClass('tab-selected');
			
			refreshTimeagos();
		};
		
		destroyReply = $scope.destroyReply = function() {
			$scope.replyTargetMessage = -1;
			$scope.replyTargetAuthorDisplayName = -1;
			
			$('#input_message').data('reply-target-author', $scope.replyTargetAuthorDisplayName);
			$('#input_message').popover('hide');
		};
		
		$scope.formatTaskTime = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			var niceTime = moment.unix(task.time).format('h:mma [on] MMM D, YYYY');
			return niceTime;
		};
		
		$scope.toggleAudio = function() {
			var $audioIcon = $('#audio_icon');
			
			if($scope.audioEnabled) {
				$audioIcon.removeClass('glyphicon-volume-up');
				$audioIcon.addClass('glyphicon-volume-off');
				$scope.audioEnabled = false;
			} else {
				$audioIcon.removeClass('glyphicon-volume-off');
				$audioIcon.addClass('glyphicon-volume-up');
				$scope.audioEnabled = true;
			}
		};
		
		getReplyTargetAuthorDisplayName = $scope.getReplyTargetAuthorDisplayName = function(replyTargetID) {
			var replyTarget = getEntryByID($scope.messages, replyTargetID);
			return replyTarget.authorDisplayName;
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
		
		$scope.addMessage = function() {
			if(!$scope.inputMessage) {
				return false;
			}
			
			var messageData = {
				'room': global_roomID,
				'author': global_username,
				'content': $scope.inputMessage,
				'reply': $scope.replyTargetMessage
			};
			
			socket.emit('cts_message', messageData);
			
			$scope.destroyReply();
			
			// $scope.messages.push(messageData); // TODO do we use a temporary?
			
			$scope.inputMessage = '';
			$('#input_message').trigger('autosize.resize'); // necessary to get textarea to resize
			
			return false;
		};
		
		$scope.addTaskFollowup = function(taskID) {
			var task = getEntryByID($scope.tasks, taskID);
			
			if(!task.followupContent) {
				return false;
			}
			
			var followupData = {
				'task': taskID,
				'author': global_username,
				'content': task.followupContent
			};
			
			socket.emit('cts_followup_task', followupData);
			
			task.followupContent = '';
			
			return false;
		};
		
		$scope.followupEntry = function(taskID) {
			return 'followupEntry' + taskID;
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
		
		socket.on('recoverableError', function(message) { // message is an event object for some reason, not a string
			console.error(message);
			console.error('Error: Web socket disconnected');
			alert('Error: Web socket disconnected!');
			window.location.href = '/';
		});
		
		socket.on('stc_rejoin', function() {
			if(global_joinedOnce) {
				socket.emit('join', $scope.room.id, $scope.username);
			}
		});
		
		socket.on('membership_change', function(members) {
			$scope.members = members.map(function(member) {
				member.idle = false;
				return member;
			});
			$scope.members.push({
				username: $scope.username,
				display_name: $scope.displayName,
				idle: false
			});
			
			$scope.$apply();
		});
		
		socket.on('stc_add_task', function(newTask) {
			$scope.tasks.push(newTask);
			$scope.$apply();
			
			if($scope.audioEnabled) {
				playTaskNotification();
			}
		});
		
		socket.on('stc_task_status_changed', function(taskID, newStatus) {
			var task = getEntryByID($scope.tasks, taskID);
			task.status = newStatus;
			$scope.$apply();
		});
		
		socket.on('stc_followup_task', function(taskFollowup) {
			console.log(taskFollowup);
			var task = getEntryByID($scope.tasks, taskFollowup.task);
			task.followups.push(taskFollowup);
			$scope.$apply();
		});
		
		socket.on('stc_message', function(newMessage) {
			$scope.messages.push(newMessage);
			var atBottom = scrolledToBottom('#messages');
			$scope.$apply();
			
			if($scope.audioEnabled) {
				playMessageNotification();
			}
			if(atBottom) {
				scrollBottom('#messages');
			}
		});
		
		socket.on('stc_user_idle', function(username) {
			var member = getMemberByUsername($scope.members, username);
			if(member) {
				member.idle = true;
				$scope.$apply();
			}
		});
		
		socket.on('stc_user_active', function(username) {
			var member = getMemberByUsername($scope.members, username);
			if(member) {
				member.idle = false;
				$scope.$apply();
			}
		});
		
		socket.on('stc_typing', function(username) {
			/*
			if(!members_typing_cooldown[username]) {
				members_typing_cooldown[username] = true;
			}
			
			if(!members_typing_flag[username]) {
				addTypingNote(username);
				members_typing_flag[username] = true;
			}
			*/
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
		
		$('#sidebar').mouseenter(function() {
			var $this = $(this);
			
			$('#sidebar_content').stop(false, true).show({
				'effect': 'fade',
				'duration': 300,
				'queue': false
			});
			$this.stop().animate({ // properties
				'width': '200px'
			}, { // options
				'duration': 400,
				'queue': false
			});
		});
		
		$('#sidebar').mouseleave(function() {
			var $this = $(this);
			
			$('#sidebar_content').stop(false, true).hide({
				'effect': 'fade',
				'duration': 300,
				'queue': false
			});
			$this.stop().animate({ // properties
				'width': '25px'
			}, { // options
				'duration': 400
			});
		});
	});
}]);

/*###################################
  #        SUPPORT FUNCTIONS        #
  ###################################*/

// some initialization actions that occur only once when the page is loaded
function initializePage() {
	$('#input_message').autosize();
	$('#input_message').popover({
		html: true,
		placement: 'left',
		trigger: 'manual',
		content: function() {
			var replyTargetAuthorDisplayName = $('#input_message').data('reply-target-author');
			var htmlString = '<span id="reply_popover_content">Replying to ' + replyTargetAuthorDisplayName + '</span>' + 
							'<button id="close_reply_popover" onclick="destroyReply()" type="button" class="close">&times;</button>';
			return htmlString;
		}
	});
	
	scrollBottom('#messages');
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

function getMemberByUsername(list, username) {
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

function playMessageNotification() {
	document.getElementById('message_audio').play();
}

function playTaskNotification() {
	document.getElementById('task_audio').play();
}

function getMillisecondTime() {
	return new Date().getTime() / 1000;
}
