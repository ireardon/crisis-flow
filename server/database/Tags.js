var locals = require(__localModules);
var report = require(locals.lib.report);
var utils = require(locals.lib.utilities);

module.exports = function(datastoreConnection) {
    this.dataConn = datastoreConnection;

    function Tags() {
        return {
            'create': createTag,
            'createAll': createTags,
            'getAll': getAllTags,
            'createNewTags': createNewTags
        };
    }

    function createTag(name, callback) {
    	var sql = 'INSERT INTO tags(name) VALUES($name)';
    	dataConn.run(sql, {$name: name}, function(error) {
    		report.error(error, 'Tags.createTag failed');

    		if(utils.validCallback(callback)) {
    			callback(error, this.lastID);
    		}
    	});
    }

    // callback is called with an arg which is the ids of all created tags
    function createTags(names, callback) {
    	createTagsRecursive(0, names, [], callback);
    }

    function createTagsRecursive(current, names, createdIdentifiers, callback) {
    	if(current === names.length) {
    		if(utils.validCallback(callback)) {
    			callback(false, createdIdentifiers);
    		}
    	} else {
    		var name = names[current];
    		createTag(name, function(error, newTagID) {
    			if(error) {
    				callback(error);
    				return;
    			}

    			createdIdentifiers.push(newTagID);
    			current++;
    			createTagsRecursive(current, names, createdIdentifiers, callback);
    		});
    	}
    }

    function getAllTags(callback) {
    	var sql = 'SELECT * FROM tags ORDER BY name ASC';
    	dataConn.all(sql, {}, function(error, rows) {
    		report.error(error, 'Tags.getAllTags failed');

    		if (utils.validCallback(callback))
    			callback(error, rows);
    	});
    }

    // callback called with arg which is a list of the tag IDs of both new and preexisting selected tags
    function createNewTags(selectedTags, preexistingTags, callback) {
    	if(!selectedTags) {
    		callback(false, []);
    		return;
    	}

    	if(!(selectedTags instanceof Array)) { // this is necessary because selectedTags may be a singleton
    		selectedTags = [selectedTags];
    	}

    	var newTagNames = [];
    	var oldTagIdentifiers = [];
    	for(var i=0; i<selectedTags.length; i++) {
    		var currentTag = selectedTags[i];
    		var index = preexistingTags.indexOf(Number(currentTag)); // coerce potential ids to numbers

    		if(index === -1) { // this selected tag is not preexisting
    			newTagNames.push(currentTag);
    		} else { // this selected tag is preexisting
    			oldTagIdentifiers.push(currentTag);
    		}
    	}

    	createTags(newTagNames, function(error, newTagIdentifiers) {
    		if(error) {
    			callback(error);
    			return;
    		}

    		var selectedTagIdentifiers = oldTagIdentifiers.concat(newTagIdentifiers);
    		callback(false, selectedTagIdentifiers);
    	});
    }

    return new Tags();
};
