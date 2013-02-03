var transcode = require('./lib/transcode');

var mongolian = require('mongolian');
var ObjectId = mongolian.ObjectId;
var db = (new mongolian()).db('music');
var songs = db.collection('songs');

var express = require('express');
var http = require('http');
var wsio = require('websocket.io');

var app = express();
var server = http.createServer(app);
var ws = wsio.attach(server);
server.listen(5775);

app.get('/song/:id.:ext', function(req, res){
	songs.find({_id: new ObjectId(req.params.id)}, {file: true})
		.limit(1)
		.toArray(function(err, songs){
			if (err) console.log(err);
			var ext = songs[0].file.split('.').pop();
			
			if (ext == req.params.ext) {
				res.sendfile(songs[0].file);
			} else {
				//transcode that bitch
				var transcoder = transcode(songs[0].file, req.params.ext);
				if (transcoder !== false) {
					transcoder.pipe(res);
				} else {
					//cannot transcode this. :(
					res.send(404);
				}
			}
		});
});

var inputWalker = function(socket, data){
	for (var i in data) {
		var type = typeof data[i];
		if (type == 'object' && data[i] !== null) {
			if (data[i].__type == 'callback') {
				data[i] = (function(functionID){
					return function(){
						var packet = [functionID];
						for (var i in arguments) {
							packet.push(arguments[i]);
						}
						socket.send(JSON.stringify(packet));
					};
				})(data[i].id);
			} else {
				inputWalker(socket, data[i]);
			}
		}
	}
};

var api = {
	music: {
		findArtists: function(client, callback){
			songs.distinct('artist', function(err, artistList){
				if (err) {
					callback && callback(false);
				} else {
					artistList.sort();
					client.syncArtists(artistList);
					var out = [];
					for (var i in artistList) {
						out.push( client.known.artists[artistList[i]] );
					}
					callback && callback(out);
				}
			});
		},
		findAlbumsByArtist: function(client, artist, callback){
			songs.distinct('album', {artist: artist}, function(err, albumList){
				if (err) {
					callback && callback(false);
				} else {
					albumList.sort();
					callback && callback( client.syncAlbums(albumList) );
				}
			});
		},
		findSongsByArtist: function(client, artist, callback){
			songs.find({artist: artist})
				.sort({'album': 1, 'track': 1})
				.toArray(function(err, songList){
					if (err) throw err;
					for (var i in songList) {
						songList[i]._id = songList[i]._id.toString();
						if (!songList[i].albumartist || songList[i].albumartist == songList[i].artist) {
							delete songList[i].albumartist;
						}
						delete songList[i].file;
					}
					songList = client.syncSongs(songList);
					client.reply(songList) || callback(songList);
				});
		},
		findSongs: function(client, songIDs, callback){
			for (var i in songIDs) {
				songIDs[i] = new ObjectId(songIDs[i]);
			}
			songs.find({ _id: {'$in': songIDs} })
				.toArray(function(err, songList){
					for (var i in songList) {
						songList[i]._id = songList[i]._id.toString();
						if (!songList[i].albumartist || songList[i].albumartist == songList[i].artist) {
							delete songList[i].albumartist;
						}
						delete songList[i].file;
					}
					songList = client.syncSongs(songList);
					client.reply() || callback();
				});
		},
		sync: function(client, callback){
			client.syncCallback = (client.allowsCallbacks && callback) ? callback : function(){client.reply.apply(client,arguments)};
		}
	}
};

var WSClient = function(socket){
	this.socket = socket;
	
	this.syncCallback = function(){};
	this.iterators = {
		artists: 1,
		albums: 1
	};
	this.known = {
		songs: {},
		artists: {},
		albums: {}
	};
	this.syncQueue = {
		songs: {},
		artists: {},
		albums: {}
	};
};
WSClient.prototype.allowsCallbacks = true;
WSClient.prototype.reply = function(){
	return false;
};
WSClient.prototype.flush = function(){
	for (var i in this.syncQueue) {
		if (Object.keys(this.syncQueue[i]).length == 0) {
			delete this.syncQueue[i];
		}
	}
	if (Object.keys(this.syncQueue).length > 0) {
		this.syncCallback && this.syncCallback(this.syncQueue);
	}
	this.syncQueue.songs = {};
	this.syncQueue.artists = {};
	this.syncQueue.albums = {};
};
WSClient.prototype.syncSongs = function(list){
	var out = [];
	for (var i in list) {
		out.push( this.syncSong( list[i] ) );
	}
	this.flush();
	return out;
};
WSClient.prototype.syncArtists = function(list){
	var out = [];
	for (var i in list) {
		out.push( this.syncArtist( list[i] ) );
	}
	this.flush();
	return out;
};
WSClient.prototype.syncAlbums = function(list){
	var out = [];
	for (var i in list) {
		out.push( this.syncAlbum( list[i] ) );
	}
	this.flush();
	return out;
};
WSClient.prototype.syncSong = function(song){
	if (this.known.songs[ song._id ]) {
		//it is known
	} else {
		var songCopy = {};
		for (var i in song) {
			songCopy[i] = song[i];
		}
		
		songCopy.artist = this.syncArtist(song.artist);
		songCopy.album = this.syncAlbum(song.album);
		
		this.syncQueue.songs[ song._id ] = songCopy;
		
		this.known.songs[ song._id ] = true;
	}
	return song._id;
};
WSClient.prototype.syncArtist = function(name){
	if (this.known.artists[name]) {
		//it is known
	} else {
		var artistID = this.iterators.artists;
		this.iterators.artists++;
		
		this.known.artists[name] = artistID;
		
		this.syncQueue.artists[artistID] = name;
	}
	return this.known.artists[name];
};
WSClient.prototype.syncAlbum = function(name){
	if (this.known.albums[name]) {
		//it is known
	} else {
		var albumID = this.iterators.albums;
		this.iterators.albums++;
		
		this.known.albums[name] = albumID;
		
		this.syncQueue.albums[albumID] = name;
	}
	return this.known.albums[name];
};

ws.on('connection', function(socket){
	var client = new WSClient(socket);
	socket.on('message', function(msg){
		try {
			var args = JSON.parse(msg);
			inputWalker(socket, args);
		} catch (err) {
			console.log(err);
			socket.close();
			return;
		}
		
		if (!Array.isArray(args)) return;
		if (args.length < 2) return;
		
		var type = args.shift();
		var method = args.shift();
		
		if (typeof type != 'string' || typeof method != 'string') return;
		
		if (typeof api[type] == 'undefined') return;
		if (typeof api[type][method] == 'undefined') return;
		
		args.unshift(client);
		
		api[type][method].apply(api[type], args);
	});
});
