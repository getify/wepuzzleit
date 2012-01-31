var ww_socket = "http://174.120.72.139:80";

importScripts(ww_socket+"/socket.io/socket.io.js");

var socket,
	socket_initialized = false,
	game_session_started = false,
	can_send_tile_movement = true,
	tile_movement_throttle = false
;

function initializeGameSession(game_session_id) {
	if (!socket) {
		socket = io.connect(ww_socket+"/ww");
	}
	
	if (!socket_initialized) {
		socket_initialized = true;
		
		socket.on("game_session_valid", function(data) {
			var i, id, new_tiles = {};
			
			self.postMessage({
				overview: data.overview,
				tiles: data.tiles,
				rows: data.rows,
				cols: data.cols,
				tile_size: data.tile_size,
				in_play: data.in_play
			});
		});
		
		socket.on("position_tile", function(data) {
			self.postMessage({
				position_tile: true,
				tile_id: data.tile_id,
				position: data.position
			});
		});
		
		socket.on("move_tile", function(data) {
			self.postMessage({
				move_tile: true,
				moves: data.moves
			});
		});
		
		socket.on("reset_tile",function(data) {
			self.postMessage({
				reset_tile: true,
				tile_id: data.tile_id
			});
		});
		
		socket.on("game_session_invalid", function(data) {
			self.postMessage({error: "game_session_invalid"});
		});

		socket.on("reset_player",function() {
			self.postMessage({reset_player: true});
		});
	}
	
	if (!game_session_started) {
		game_session_started = true;
		socket.emit("establish_game_session", {game_session_id: game_session_id});
	}
}

function take_tile(tile_id) {
	socket.emit("take_tile",{tile_id: tile_id},function(ok){
		if (ok) {
			self.postMessage({tile_drag_ok: true});
		}
		else {
			self.postMessage({tile_drag_invalid: true});
		}
	});
	if (tile_movement_throttle) {
		clearTimeout(tile_movement_throttle);
		tile_movement_throttle = false;
	}
}

function move_tile(tile_id,x,y) {
	if (!tile_movement_throttle) {
		socket.emit("move_tile",{
			tile_id: tile_id,
			x: x,
			y: y
		});
		tile_movement_throttle = setTimeout(function(){
			tile_movement_throttle = false;
		},167);
	}
}

function try_tile_position(tile_id,position) {
	socket.emit("try_tile_position",{
		tile_id: tile_id,
		position: position
	});
	if (tile_movement_throttle) {
		clearTimeout(tile_movement_throttle);
		tile_movement_throttle = false;
	}
}

self.onmessage = function(evt) {
	switch (evt.data.messageType) {
		case "start":
			initializeGameSession(evt.data.game_session_id);
			break;
		case "take_tile":
			take_tile(evt.data.tile_id);
			break;
		case "move_tile":
			move_tile(evt.data.tile_id,evt.data.x,evt.data.y);
			break;
		case "try_tile_position":
			try_tile_position(evt.data.tile_id,evt.data.position);
			break;
	}
};