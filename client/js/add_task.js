var room_id;

$(document).ready(function() {
	room_id = document.querySelector('meta[name=room_id]').content;
	$('#task_tags').select2({
		tags: true,
		tokenSeparators: [',']
	});
	
	$('#high_priority_button').on('click', function() {
		var $this = $(this);
		
		if($this.data('high-priority')) { // currently marked as high priority
			$this.data('high-priority', false);
			$this.text('Mark as high priority');
			$('#high_priority_input').val(false);
		} else { // currently marked as normal priority
			$this.data('high-priority', true);
			$this.text('High priority');
			$('#high_priority_input').val(true);
		}
		
		$this.toggleClass('btn-default btn-danger');
	});
	
	$('#additional_files_button').on('click', function() {
		var $uploads = $('#upload_files');
		var numFiles = Number($uploads.data('num-files'));
		var nextFilenum = numFiles + 1;
		
		var htmlString = '<input type="file" class="file_input form-control" name="file' + nextFilenum + '" id="file' + nextFilenum + '" form="add_task_form"></input>';
		$uploads.append(htmlString);
		
		$uploads.data('num-files', nextFilenum);
	});
	
	/*
	$('#add_task_form').submit(function(event) {
		event.preventDefault();
		
		var title_val = $('#task_title').val();
		var content_val = $('#task_content').val();
		var priority_val = $('#high_priority_button').data('high-priority');
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
	*/
});