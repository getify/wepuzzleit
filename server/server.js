function defaultServer(req, res) {
  if (req.url == '/') {
    res.writeHead(200,{"Content-Type":"text/html"});
    res.end("Nothing to see here. Instead, go to the game itself: <a href='http://test.getify.com/wepuzzleit/'>We Puzzle It!</a>");
  }
  else return false;
}

function new_game_id() {
  var id;
  do {
    id = Math.round(Math.random() * 1E9);
  } while (typeof games[id] != "undefined");
  games[id] = {};
  return id;
}

function new_session_id() {
  var id;
  do {
    id = Math.round(Math.random() * 1E9);
  } while (typeof sessions[id] != "undefined");
  sessions[id] = true;
  return id;
}

function new_game_session_id() {
  var id;
  do {
    id = Math.round(Math.random() * 1E9);
  } while (typeof game_sessions[id] != "undefined");
  game_sessions[id] = {};
  return id;
}

function new_tile_id() {
  var id;
  do {
    id = Math.round(Math.random() * 1E9);
  } while (typeof tiles[id] != "undefined");
  tiles[id] = true;
  return id;
}

function scramble_tiles(game) {
  var tile_id, loc;

  // assign tile id's, and preserve the original tile order
  game.tile_order = [];
  for (var i=0; i<game.orig_tiles.length; i++) {
    tile_id = new_tile_id();
    game.tile_order.push(tile_id);
    game.orig_tiles[i] = {tile_id:tile_id,data:game.orig_tiles[i]};
  }

  // randomly scramble the tile order
  game.tiles = {};
  while (game.orig_tiles.length) {
    loc = Math.floor(Math.random() * 1E6) % game.orig_tiles.length;

    game.tiles[game.orig_tiles[loc].tile_id] = {"data":game.orig_tiles[loc].data,"available":true,"position":null};
    game.orig_tiles.splice(loc, 1);
  }
  delete game.orig_tiles;
}

function startGameClock(game_id) {
  var game = games[game_id];

  // push out update of game clock immediately
  io.of('/site').in("game:"+game_id).emit("game_clock", {time_left:game.time_left} );

  if (!game.clock) {
    game.clock = setInterval(function(){
      if (game.in_play && !game.is_closed) {
        game.time_left = Math.max(0,game.time_left - 5);
        io.of('/site').in("game:"+game_id).emit("game_clock", {time_left:game.time_left} );

        // game clock at 0, so expire game
        if (game.time_left == 0) {
          clearInterval(game.clock);
          game.clock = null;

          game.in_play = false;
          io.of('/site').in("game:"+game_id).emit("freeze_game", {"game_id":game_id} ); // notify connected game sessions of it being over and frozen

          // game is over and frozen, so close it in 30 seconds
          setTimeout(function(){
            game.is_closed = true;
            game.preview = game.tiles = game.tile_order = game.users = null;
            game.rows = game.cols = game.tile_size = 0;

            io.of('/site').emit("close_game", {"game_id":game_id} ); // notify all users of the game closing
          },30*1000);
        }
      }
      else {
        clearInterval(game.clock);
        game.clock = null;
      }
    },5*1000);
  }
}


var httpserv = require('http').createServer(defaultServer),
    io = require('/usr/local/lib/node_modules/socket.io').listen(httpserv),

    sessions = {},
    game_sessions = {},
    users = {},
    games = {},
    tiles = {}
;

httpserv.listen(80, "xx.yy.zz.ww");


io.configure(function(){
//  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
//  io.set('log level', 1);                    // reduce logging
  io.set('transports', [                     // enable all transports (optional if you want flashsocket)
      'websocket'
    , 'flashsocket'
    , 'htmlfile'
    , 'xhr-polling'
    , 'jsonp-polling'
  ]);
});


// site socket channel
io.of('/site').on('connection', function (socket) {
  var session_id, current_game_session_id;

  function leave_game(game_session_id) {
    var game_id, game;

    if (game_sessions[game_session_id] && game_sessions[game_session_id].game_id) {
      game_id = game_sessions[game_session_id].game_id;
      game_sessions[game_session_id] = false;
      try { socket.leave("game:"+game_id); } catch (err) { }
      game = games[game_id];

      if (game && game.users) {
        for (var i=0; i<game.users.length; i++) {
          if (game.users[i] == session_id) {
            game.users.splice(i,1);
            break;
          }
        }

        current_game_session_id = null;
        if (session_id && users[session_id]) {
          io.of('/site').in("game:"+game_id).emit("user_leave", {"name":users[session_id].name} );
        }
      }
    }
  }

  function game_user_list(game_id) {
    var game = games[game_id],
        list = []
    ;
    if (game && game.users) {
      for (var i=0; i<game.users.length; i++) {
        list.push(users[game.users[i]].name);
      }
    }
    return list;
  }

  socket.on('validate_session', function(data) {
    if (data.session_id && !session_id) {
      session_id = data.session_id;
    }
    if (session_id && sessions[session_id]) {
      if (users[session_id]) {
        users[session_id].connected = true;
        socket.emit('session_valid', {session_id:session_id, user_info:users[session_id]} );
        socket.emit('score_update', {score:users[session_id].score} );
      }
      else {
        socket.emit('session_valid', {session_id:session_id, user_info:null} );
      }
    }
    else {
      session_id = new_session_id();
      sessions[session_id] = true;
      socket.emit('new_session', {session_id: session_id} );
    }
  });

  socket.on('login', function(data) {
    var resp = {};
    if (!session_id || !sessions[session_id]) {
      resp.new_session_id = session_id = new_session_id();
    }
    if (users[session_id]) {
      resp.already_logged_in = true;
      resp.name = users[session_id].name;
      resp.email = users[session_id].email;
      users[session_id].connected = true;
    }
    else {
      if (!data.name || data.name.length < 2) resp.error = "First name must be 2 or more characters.";
      else if (!data.email || data.email.length < 6 || !(data.email.indexOf("@") > 0)) resp.error = "Email must be valid.";
      else {
        var user_found = false;
        for (var i in users) {
          if (i != session_id && users[i] && users[i].name.toLowerCase() == data.name.toLowerCase() && users[i].email.toLowerCase() == data.email.toLowerCase()) {
            user_found = i;
            break;
          }
        }
        if (user_found) {
          if (users[user_found].connected) {
            resp.error = "User is already connected!";
          }
          else {
            users[session_id] = {name:users[user_found].name, email:users[user_found].email, connected:true, score:users[user_found].score};
            delete users[user_found];
            resp.login_successful = true;
          }
        }
        else {
          users[session_id] = {name:data.name, email:data.email, connected:true, score:0};
          socket.on('disconnect', function() {
            if (users[session_id]) users[session_id].connected = false;
          });
          resp.login_successful = true;
        }
        if (users[session_id]) {
          resp.name = users[session_id].name;
          resp.email = users[session_id].email;
        }
      }
    }
    if (resp.error) {
      socket.emit('login_error', resp );
    }
    else {
      socket.emit('login_complete', resp );
      socket.emit('score_update', {score:users[session_id].score} );
    }

  });

  socket.on('disconnect', function() {
    if (users[session_id]) {
      users[session_id].connected = false;
      if (current_game_session_id) leave_game(current_game_session_id);
    }
  });

  socket.on('logout', function(data,cb) {
    sessions[data.session_id] = false;
    if (users[data.session_id]) users[data.session_id].connected = false;
    cb("logged_out");
    socket.emit('score_update', {score:'..'});
  });

  socket.on('list_games', function(data) {
    var game_ids = [];
    for (var i in games) {
      if (!games[i].is_closed) {
        game_ids.push(i);
      }
    }
    socket.emit('open_games', {games:game_ids} );
  });

  socket.on('join_game', function(data,cb) {
    var game_id = data.game_id;

    if (games[game_id] && games[game_id].users) {
      current_game_session_id = new_game_session_id();
      game_sessions[current_game_session_id] = {"game_id":game_id,"session_id":session_id};
      cb(current_game_session_id);
      socket.emit("user_list", {"list":game_user_list(game_id)} );

      games[game_id].users.push(session_id);
      socket.join("game:"+game_id);
      io.of('/site').in("game:"+game_id).emit("user_join", {"name":users[session_id].name} );
    }
    else {
      socket.emit("game_error",{});
    }
  });

  socket.on('leave_game', function(data) {
    leave_game(data.game_session_id);
  });

  socket.on('create_game', function(data,cb) {
    var game_id = new_game_id(),
        game = games[game_id]
    ;
    game.is_closed = false;
    game.in_play = false;
    game.preview = data.preview;
    game.orig_tiles = data.tiles;
    game.rows = data.rows;
    game.cols = data.cols;
    game.tile_size = data.tile_size;
    game.users = [];
    game.time_left = 60 * 5;
    scramble_tiles(game);
    cb(game_id);

    io.of('/site').emit("new_game", {"game_id":game_id} ); // broadcast the message to all sockets
  });
});


// web worker socket channel
io.of('/ww').on('connection', function(socket) {
  var session_id, game_session_id, game_id;

  socket.on('establish_game_session', function(data) {
    if (game_sessions[data.game_session_id] && game_sessions[data.game_session_id].game_id) {
      game_session_id = data.game_session_id;
      game_id = game_sessions[game_session_id].game_id;
      session_id = game_sessions[game_session_id].session_id;

      if (sessions[session_id] && users[session_id] && users[session_id].connected && games[game_id] && !games[game_id].is_closed) {
        socket.join("game:"+game_id);

        socket.emit("game_session_valid", {"preview":games[game_id].preview,"tiles":games[game_id].tiles,"rows":games[game_id].rows,"cols":games[game_id].cols,"tile_size":games[game_id].tile_size,"in_play":(games[game_id].in_play || games[game_id].time_left)} );

        // first user to join the game? start the clock.
        if (!games[game_id].in_play && games[game_id].time_left) {
          games[game_id].in_play = true;

          // send out initial clock time
          io.of('/site').in("game:"+game_id).emit("game_clock", {time_left:games[game_id].time_left} );

          // count down the game clock
          startGameClock(game_id);
        }

        return;
      }
    }

    // if we get here, something's wrong with the game session, so bail
    socket.emit("game_session_invalid",{});
  });

  socket.on('take_tile', function(data,cb) {
    var tile_id = data.tile_id;

    if (games[game_id] && games[game_id].in_play) {
      if (games[game_id].tiles[tile_id] && games[game_id].tiles[tile_id].available) {
        games[game_id].tiles[tile_id].available = false;
        games[game_id].tiles[tile_id].position = null;
        cb(true);
        return;
      }
    }

    // if we get here, the tile is not ok to take, so bail
    cb(false);
  });

  socket.on('try_tile_position', function(data) {
    var tile_id = data.tile_id,
        position = data.position
    ;

    if (games[game_id] && games[game_id].in_play && games[game_id].tiles[tile_id]) {
      if (games[game_id].tile_order[position] == tile_id) {
        games[game_id].tiles[tile_id].available = false;
        games[game_id].tiles[tile_id].position = position;
        io.of('/ww').in("game:"+game_id).emit("position_tile", {"tile_id":tile_id, "position":position} ); // tell all players of the correctly positioned tile
      }
      else {
        games[game_id].tiles[tile_id].available = true;
        games[game_id].tiles[tile_id].position = null;
        io.of('/ww').in("game:"+game_id).emit("reset_tile", {"tile_id":tile_id} ); // incorrectly placed, reset the tile for all players
      }
    }
  });

  socket.on('move_tile', function(data) {
    var tile_id = data.tile_id,
        x = data.x,
        y = data.y
    ;

    if (games[game_id] && games[game_id].tiles && games[game_id].tiles[tile_id]) {
      io.of('/ww').in("game:"+game_id).emit("move_tile", {"tile_id":tile_id, "x":x, "y":y} ); // tell all players of the movements of the tile as it's dragged
    }
  });

  socket.on('reset_tile', function(data) {
    var tile_id = data.tile_id;

    if (games[game_id] && games[game_id].tiles && games[game_id].tiles[tile_id]) {
      games[game_id].tiles[tile_id].available = true;
      games[game_id].tiles[tile_id].position = null;
      io.of('/ww').in("game:"+game_id).emit("reset_tile", {"tile_id":tile_id} ); // reset the tile for all players
    }
  });

  socket.on('disconnect', function(data) {
    try { socket.leave("game:"+game_id); } catch (err) { }
    session_id = game_session_id = game_id = null;
  });

});
