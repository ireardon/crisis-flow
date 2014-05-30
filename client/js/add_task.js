var room_id;

$(document).ready(function() {
	room_id = document.querySelector('meta[name=room_id]').content;
	$('#task_high_priority').data('high-prio', false);
	
	$('#task_high_priority').on('click', function() {
		var $this = $(this);
		
		if($this.data('high-prio')) { // currently marked as high priority
			$this.data('high-prio', false);
			$this.text('Mark as high priority');
		} else { // currently marked as normal priority
			$this.data('high-prio', true);
			$this.text('High priority');
		}
		
		$this.toggleClass('btn-default btn-danger');
	});
	
	$('#add_task_form').submit(function(event) {
		event.preventDefault();
		
		var title_val = $('#task_title').val();
		var content_val = $('#task_content').val();
		var priority_val = $('#task_high_priority').data('high-prio');
		console.log(priority_val);
		
		var task_data = {
			'title': title_val,
			'content': content_val,
			'high_priority': priority_val
		};
		
		$.post('/add_task/' + room_id, task_data, function(response) {
			console.log(response);
			if(response.error) {
				alert(response.error);
			} else {
				window.location.href = '/rooms/' + room_id;
			}
		});
		
		return false;
	});
});