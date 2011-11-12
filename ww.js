var ww_socket = "http://xx.yy.zz.ww:80";

importScripts(ww_socket+"/socket.io/socket.io.js");

var socket,
	socket_initialized = false,
	session_valid = false,
	game_session_started = false,
	socket_queue = []
;

function process_socket_queue() {
	var fn;
	while (fn = socket_queue.shift()) fn();
	socket_queue = true;
}

function initializeGameSession(session_id,game_id) {
	if (!socket) {
		socket = io.connect(ww_socket+"/ww");
	}
	
	if (!socket_initialized) {
		socket_initialized = true;
		
		socket.on("game_session_valid", function(data) {
			self.postMessage({preview:data.preview});
			self.postMessage({tiles:data.tiles,rows:data.rows,cols:data.cols,tile_size:data.tile_size});
			process_socket_queue();
		});
		
		socket.on("game_session_invalid", function(data) {
			self.postMessage({error:"game_session_invalid"});
		});
	}
	
	if (!game_session_started) {
		game_session_started = true;
		socket.emit("establish_game_session", {session_id:session_id, game_id:game_id} );
	}
}

function playGame() {
	//self.postMessage("game started!");
}

function doOrQueue(fn) {
	if (socket_queue !== true) socket_queue.push(fn);
	else fn();
}

self.onmessage = function(evt) {
	switch (evt.data.messageType) {
		case "start":
			initializeGameSession(evt.data.session_id,evt.data.game_id);
			doOrQueue(playGame);
			break;
	}
};