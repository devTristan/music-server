var fs = require('fs');
var walk = require('walk');
var async = require('async');
var spawn = require('child_process').spawn;

var mongolian = require('mongolian');
var db = (new mongolian()).db('music');
var songs = db.collection('songs');

var errors = [];

var supportedExtensions = {
	mp3: true,
	m4a: true,
	ogg: true,
	flac: true
};

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
	
	var data = '';
	
	exiftool.stdout.on('data', function(chunk){
		data += chunk;
	});
	
	exiftool.stdout.on('end', function(){
		data = JSON.parse(data);
		for (var i in data) {
			var tracknum = (data[i].Track || data[i].TrackNumber || 0) * 1;
			var song = {
				track: tracknum,
				title: data[i].Title || makeTitle(tracknum, data[i].FileName),
				length: (data[i].Duration) ? makeLength(data[i].Duration) : 0,
				artist: data[i].Artist,
				albumartist: data[i].AlbumArtist || data[i].Artist,
				album: data[i].Album,
				year: data[i].Year || data[i].Date,
				genre: data[i].Genre,
				bitrate: makeBitrate(data[i].AudioBitrate || data[i].LameBitrate || '0'),
				file: data[i].SourceFile
			};
			songs.update({file: data[i].SourceFile}, song, true);
		}
		next();
	});
}, 4);

var fileList = [];

var walker = walk.walk(__dirname+'/music');
walker.on("file", function(dir, stats, next){
	var file = dir+'/'+stats.name;
	
	var ext = file.split('.').pop();
	if (!supportedExtensions[ext]) return next();
	
	fileList.push(file);
	
	if (fileList.length == 100) {
		q.push({files: fileList});
		fileList = [];
	}
	
	next();
});

walker.on('end', function(){
	if (fileList.length) {
		q.push({files: fileList});
		fileList = [];
	}
	q.drain = function(){
		console.log('done');
		db.server.close()
	};
});
