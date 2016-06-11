var room_id;

$(document).ready(function() {
	room_id = document.querySelector('meta[name=room_id]').content;
	
	$.ajax({
		type: 'GET',
		url: '/tags.json',
		dataType: 'json',
		success: function(tagData) {
			var tags = tagData.map(function(tag) {
				return {'id': tag.id, 'text': tag.name};
			});
			
			$('#task_tags').select2({
				tags: tags,
				tokenSeparators: [','],
				width: 'resolve',
				placeholder: 'Click to select or type'
			});
		}
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
});