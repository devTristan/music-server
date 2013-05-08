var library = require('./lib/library');
var scanner = require('./lib/scanner');
var api = require('./lib/api');
//var ui = require('./lib/ui');
var config = require('./lib/config').open(__dirname+'/config.json');

if (!config.installed) {
	config.installed = true;
	config.port = 5775;
	config.save();
}

api.server.listen(config.port);

library.file(__dirname+'/db.json');
library.restore();

//ui.show();

/*if (!config.folder) {
	ui.on('library_folder', function(folder){
		config.folder = folder;
		config.save();
		scanner(config.folder, function(){
			library.backup();
		});
	});
}*/
