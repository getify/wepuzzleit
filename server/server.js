function defaultServer(req, res) {
  if (req.url == '/') {
    res.writeHead(200,{"Content-Type":"text/html"});
    res.end("Nothing to see here. Check out <a href='http://test.getify.com/wepuzzleit/'>We Puzzle It!</a>");
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

  game.tile_order = [];
  game.tiles = {};
  while (game.orig_tiles.length) {
    tile_id = new_tile_id();
    loc = Math.round(Math.random() * 1E4) % game.orig_tiles.length;

    game.tiles[tile_id] = {"data":game.orig_tiles[loc],"available":true,"positioned":false};
    game.tile_order.push(tile_id); // preserve "correct" order of tiles
    game.orig_tiles.splice(loc, 1);
  }
  delete game.orig_tiles;
}


var httpserv = require('http').createServer(defaultServer),
    io = require('/usr/local/lib/node_modules/socket.io').listen(httpserv),

    sessions = {},
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
  var session_id, current_game_id;

  function leave_game(game_id) {
    try { socket.leave("game:"+game_id); } catch (err) { }
    var game = games[game_id];

    if (game && game.users) {
      for (var i=0; i<game.users.length; i++) {
        if (game.users[i] == session_id) {
          game.users.splice(i,1);
          break;
        }
      }

      current_game_id = null;
      if (session_id && users[session_id]) {
        io.of('/site').in("game:"+game_id).emit("user_leave", {"name":users[session_id].name} );
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
      if (current_game_id) leave_game(current_game_id);
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

  socket.on('join_game', function(data) {
    current_game_id = data.game_id;

    socket.emit("user_list", {"list":game_user_list(current_game_id)} );

    games[current_game_id].users.push(session_id);
    socket.join("game:"+current_game_id);
    io.of('/site').in("game:"+current_game_id).emit("user_join", {"name":users[session_id].name} );
  });

  socket.on('leave_game', function(data) {
    leave_game(data.game_id);
  });

  socket.on('upload_image', function(data,cb) {
    var game_id = new_game_id(),
        game = games[game_id]
    ;
    game.is_closed = false;
    game.preview = data.preview;
    game.orig_tiles = data.tiles;
    game.rows = data.rows;
    game.cols = data.cols;
    game.tile_size = data.tile_size;
    game.users = [];
    scramble_tiles(game);
    cb(game_id);

    io.of('/site').emit("new_game", {"game_id":game_id} ); // broadcast the message to all sockets

    // force expire the game after 10 minutes
    setTimeout(function(){
      var game = games[game_id];

      game.is_closed = true;
      game.preview = null;
      game.tiles = null;
      game.tile_ids = null;
      game.rows = 0;
      game.cols = 0;
      game.tile_size = 0;
      game.users = null;

      io.of('/site').emit("close_game", {"game_id":game_id} ); // broadcast the message to all sockets
    },1000*60);
  });
});


// web worker socket channel
io.of('/ww').on('connection', function(socket) {
  var session_id, current_game_id;

  socket.on('establish_game_session', function(data) {
    if (sessions[data.session_id] && users[data.session_id] && users[data.session_id].connected && games[data.game_id] && !games[data.game_id].is_closed) {
      current_game_id = data.game_id;
      socket.join("game:"+current_game_id);

      session_id = data.session_id;
      socket.emit("game_session_valid", {"preview":games[current_game_id].preview,"tiles":games[current_game_id].tiles,"rows":games[current_game_id].rows,"cols":games[current_game_id].cols,"tile_size":games[current_game_id].tile_size} );
    }
    else {
      socket.emit("game_session_invalid",{});
    }
  });

  socket.on('disconnect', function(data) {
    try { socket.leave("game:"+current_game_id); } catch (err) { }
    current_game_id = null;
  });

});
