var fs = require('fs');

var ConfigMaker = function(file){

var lastSave = [0,0];
var saveDelay = 1;
var saveTimer;

var Config = function(){
	var fileContents;
	var fileData;
	try {
		fileContents = fs.readFileSync(file);
		fileData = JSON.parse( fileContents );
	} catch (err) {
		fileData = {};
	}
	
	for (var i in fileData) {
		this[i] = fileData[i];
	}
};
Config.prototype.save = function(nodelay, sync){
	if (!nodelay) {
		if (saveTimer) return;
		//Do it if we haven't done it in a while...
		var hrtime = process.hrtime();
		var now = hrtime[0]+(hrtime[0]/1000000000);
		var then = lastSave[0]+(lastSave[0]/1000000000);
		
		if (now - then >= this.saveDelay) { //if it's been less than saveDelay since we saved...
			this.save(true, sync); //Do it now
		} else {
			var self = this;
			saveTimer = setTimeout(function(){ //Do it later
				saveTimer = false;
				self.save(true, sync);
			}, (saveDelay - (now - then))*1000); //if save delay is 1s and it's been 300ms, do it in 700ms
		}
	} else {
		//do it now!
		var clone = {};
		for (var i in this) {
			if (i != 'save') {
				clone[i] = this[i];
			}
		}
		
		if (sync) {
			console.log('[config] sync save');
			fs.writeFileSync(file, JSON.stringify(clone));
		} else {
			console.log('[config] async save');
			fs.writeFile(file, JSON.stringify(clone));
		}
	}
};

return new Config();

};

module.exports.open = ConfigMaker;
