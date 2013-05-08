var async = require('async');
var spawn = require('child_process').spawn;

var makeLength = function(len){
	if (len.split(' s ').length == 2) {
		len = len.split(' ').shift();
		return len*1;
	}
	len = len.split(' ').shift();
	len = len.split(':');
	if (len.length == 2) {
		len.unshift(0);
	}
	len[0] = len[0]*1;
	len[1] = len[1]*1;
	len[2] = len[2]*1;
	
	return ((len[0]*60)+len[1])*60+len[2];
};
var makeBitrate = function(bitrate){
	if (typeof bitrate == 'number') {
		return bitrate/1000;
	}
	return bitrate.split(' ').shift()*1;
};
var makeTitle = function(track, filename){
	filename = filename.split('.').shift();
	track = ''+track;
	if (filename.substr(0, track.length) == track) {
		filename = filename.substr(track.length);
	}
	if (filename.substr(0, 3) == ' - ') {
		filename = filename.substr(3);
	}
	return filename;
};

var q = async.queue(function(task, next){
	task.files.unshift('-json');
	
	var exiftool = spawn('exiftool', task.files);
	console.log('extracting metadata from', task.files);
	
	var data = '';
	
	exiftool.stdout.on('data', function(chunk){
		data += chunk;
	});
	
	exiftool.stdout.on('end', function(){
		data = JSON.parse(data);
		var songs = [];
		for (var i in data) {
			var tracknum = (data[i].Track || data[i].TrackNumber || 0) * 1;
			var song = {
				track: tracknum,
				title: data[i].Title || makeTitle(tracknum, data[i].FileName),
				length: (data[i].Duration) ? makeLength(data[i].Duration) : 0,
				artist: data[i].Artist || 'Unknown',
				albumartist: data[i].AlbumArtist || data[i].Artist,
				album: data[i].Album || 'Unknown',
				year: data[i].Year || data[i].Date,
				genre: data[i].Genre || 'Unknown',
				bitrate: makeBitrate(data[i].AudioBitrate || data[i].LameBitrate || '0'),
				file: data[i].SourceFile
			};
			songs.push(song);
		}
		task.callback && task.callback(songs);
		next();
	});
}, 4);

module.exports.readFiles = function(files, callback){
	q.push({
		files: files,
		callback: callback
	});
};

module.exports.readFile = function(file, callback){
	module.exports.readFiles([file], function(songs){
		callback && callback(songs[0]);
	});
};
