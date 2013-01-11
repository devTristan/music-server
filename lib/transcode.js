var spawn = require('child_process').spawn;
var fs = require('fs');

var bitrate = 192;
var transcoders = {
	mp3: {
		flac: 'flac -cd - | lame -V 2 -b '+bitrate+' - -',
		wav: 'lame -V 2 -b '+bitrate+' - -',
		m4a: 'faad -w {{ file }} | lame -V 2 -b '+bitrate+' - -'
	},
	ogg: {
		flac: 'oggenc -b '+bitrate+' -',
		wav: 'oggenc -b '+bitrate+' -'
	}
};

var transcode = function(file, format){
	var ext = file.split('.').pop();
	
	console.log(ext, format);
	
	if (typeof transcoders[format] == 'undefined' || typeof transcoders[format][ext] == 'undefined') {
		return false;
	}
	
	console.log(transcoders[format][ext]);
	
	var transcoder;
	if (transcoders[format][ext].split('{{ file }}').length == 2) {
		var sh = transcoders[format][ext].split('{{ file }}');
		var filePart = file.replace(/(["\s'$`\\])/g,'\\$1');
		sh.splice(1, 0, filePart);
		sh = sh.join('');
		console.log(sh);
		transcoder = spawn('sh', ['-c', sh]);
	} else {
		var fileStream = fs.createReadStream(file);
		transcoder = spawn('sh', ['-c', transcoders[format][ext]]);
	
		fileStream.pipe(transcoder.stdin);
	}
	
	return transcoder.stdout;
};

module.exports = transcode;
