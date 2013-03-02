var fs = require('fs');
var walk = require('walk');

var library = require('./library');
var meta = require('./meta');

var errors = [];

var supportedExtensions = {
	mp3: true,
	m4a: true,
	ogg: true,
	flac: true
};

var readFiles = function(files, callback){
	meta.readFiles(files, function(songs){
		for (var i in songs) {
			library.create(songs[i]);
		}
		callback && callback();
	});
};

var scan = function(folder, finish){
	var fileList = [];
	
	var walker = walk.walk(folder);
	walker.on("file", function(dir, stats, next){
		var file = dir+'/'+stats.name;
		
		var ext = file.split('.').pop();
		if (!supportedExtensions[ext]) return next();
		
		fileList.push(file);
		
		if (fileList.length == 100) {
			readFiles(fileList);
			fileList = [];
		}
		
		next();
	});
	
	walker.on('end', function(){
		if (fileList.length) {
			readFiles(fileList, function(){
				console.log('done');
				finish && finish();
			});
			fileList = [];
		}
	});
};

module.exports = scan;
