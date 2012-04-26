/*! asyncGate.js
    v0.1 (c) Kyle Simpson
    MIT License: http://getify.mit-license.org
*/
(function(f){var n=f.$AG;function i(a){return Object.prototype.toString.call(a)=="[object Function]"}function o(a){return Object.prototype.toString.call(a)=="[object Array]"}function p(a){for(var b=0;b<a.length;){if(o(a[b])){a.splice.apply(a,[b,1].concat(a[b]));continue}b++}return a}function j(){var g;g=function(){var e,c=[],d=[];function k(){if(c!==true){for(var a=0;a<c.length;a++){if(c[a]!==true)return false}c=true}return(c===true)}function l(){var a;if(d!==true&&d.length){while(a=d.shift())a();d=true}}e={and:function(){if(d===true||d.length>0){throw new Error("Can't call `and()` anymore.");return e}var m=p([].slice.call(arguments)),h;for(h=0;h<m.length;h++){(function(a,b){if(!i(a))throw new Error("Wrong: non-function parameter passed in.");c[b]=false;a(function(){c[b]=true;if(k())l()})})(m[h],c.length)}return e},then:function(a){if(!i(a))throw new Error("Wrong: non-function parameter passed in.");if(d!==true){d.push(a);if(k())l()}else a();return e}};e.and.apply({},arguments);return e};g.noConflict=function(){var a=f.$AG;f.$AG=n;return a};g.sandbox=function(){return j()};return g}f.$AG=j()})(this);


function handleHTTP(req, res) {
  if (req.method == "GET") {
    if (req.url == "/") {
      res.writeHead(301,{
        "Location": "http://test.getify.com/wepuzzleit/"
      });
      res.end();
      return;
    }
    else if (req.url.match(/^\/\d+\/(?:\d+|overview\.(?:big|small))\.[a-z]+$/)) {
      req.addListener("end",function(){
        fileServer.serve(req,res);
      });
      return;
    }
  }
  return false;
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

function new_user_id() {
  var id;
  do {
    id = Math.round(Math.random() * 1E9);
  } while (typeof user_ids[id] != "undefined");
  user_ids[id] = true;
  return id;
}

function scramble_tiles(game,orig_tiles) {
  var tile_id, loc;

  // assign tile id's, and preserve the original tile order
  game.tile_order = [];
  for (var i=0; i<orig_tiles.length; i++) {
    tile_id = new_tile_id();
    game.tile_order.push(tile_id);
    orig_tiles[i] = {tile_id: tile_id, data: orig_tiles[i]};
  }

  // randomly scramble the tile order
  game.tiles = {};
  while (orig_tiles.length) {
    loc = Math.floor(Math.random() * 1E9) % orig_tiles.length;

    game.tiles[orig_tiles[loc].tile_id] = {
      data: orig_tiles[loc].data,
      available: true,
      position: null,
      user_session_id: null,
      taken: null
    };

    // remove tile from original tiles list
    orig_tiles.splice(loc, 1);
  }
}

function create_overview_image_files(game_id,errCB) {
  var gate = global.$AG(),
      game = games[game_id],
      small_buf, big_buf, img_type, ext
  ;

  img_type = game.overview.small.match(/^data:(.*?);base64,/)[1];
  ext = "." + img_type.match(/^image\/([a-z]+)$/)[1];

  small_buf = new Buffer(game.overview.small.replace(/^data:.*?,/,""),"base64");
  big_buf = new Buffer(game.overview.big.replace(/^data:.*?,/,""),"base64");

  game.overview.small = "http://" + SERVER_ADDR + (SERVER_PORT != 80 ? ":"+SERVER_PORT : "") +
    "/" + game_id + "/overview.small" + ext;
  game.overview.big = "http://" + SERVER_ADDR + (SERVER_PORT != 80 ? ":"+SERVER_PORT : "") + 
    "/" + game_id + "/overview.big" + ext;

  // push the overview image data to a files
  gate
  .and(function(done){
    fs.open("./games/"+game_id+"/overview.small"+ext,"w+",0640,function(err,fd){
      if (err) { console.error(err); errCB(); return; }
      fs.write(fd,small_buf,0,small_buf.length,0,function(err){
        if (err) { console.error(err); errCB(); return; }
        fs.close(fd,function(){
          fs.chown("./games/"+game_id+"/overview.small"+ext,1000,1000,function(err){
            if (err) { console.error(err); errCB(); return; }
            done();
          });
        });
      });
    });
  })
  .and(function(done){
    fs.open("./games/"+game_id+"/overview.big"+ext,"w+",0640,function(err,fd){
      if (err) { console.error(err); errCB(); return; }
      fs.write(fd,big_buf,0,big_buf.length,0,function(err){
        if (err) { console.error(err); errCB(); return; }
        fs.close(fd,function(){
          fs.chown("./games/"+game_id+"/overview.big"+ext,1000,1000,function(err){
            if (err) { console.error(err); errCB(); return; }
            done();
          });
        });
      });
    });
  });

  return gate;
}

function create_tile_image_files(game_id,errCB) {
  var gate = global.$AG(),
      game = games[game_id],
      tile_id, img_type
  ;

  // peek at the first tile to get the type & file extension
  tile_id = Object.keys(game.tiles)[0];
  img_type = game.tiles[tile_id].data.match(/^data:(.*?);base64,/)[1];
  ext = "." + img_type.match(/^image\/([a-z]+)$/)[1];

  // now push all the tiles' data to files
  for (var tile_id in game.tiles) {
    (function(tile_id,buf){
      game.tiles[tile_id].data = "http://" + SERVER_ADDR + (SERVER_PORT != 80 ? ":"+SERVER_PORT : "") + 
        "/" + game_id + "/" + tile_id + ext;

      gate.and(function(done){
        fs.open("./games/"+game_id+"/"+tile_id+ext,"w+",0640,function(err,fd){
          if (err) { console.error(err); errCB(); return; }
          fs.write(fd,buf,0,buf.length,0,function(err){
            if (err) { console.error(err); errCB(); return; }
            fs.close(fd,function(){
              fs.chown("./games/"+game_id+"/"+tile_id+ext,1000,1000,function(err){
                if (err) { console.error(err); errCB(); return; }
                done();
              });
            });
          });
        });
      });
    })(tile_id,new Buffer(game.tiles[tile_id].data.replace(/^data:.*?,/,""),"base64"));
  }

  return gate;
}

function checkGameTiles(game_id) {
  var game = games[game_id];

  if (game) {
    for (var i in game.tiles) {
      // is there a tile that's not yet positioned?
      if (game.tiles[i].position === null) {
        return;
      }
    }

    if (game.in_play) {
      game.in_play = false;
      // otherwise, all tiles positioned correctly, time to end the game
      setTimeout(function(){
        endGame(game_id);
      },500);
    }
  }
}

function endGame(game_id) {
  var game = games[game_id];

  if (game) {
    clearInterval(game.move_broadcast);
    game.move_broadcast = null;
    game.moves = {};
    clearInterval(game.clock);
    game.clock = null;

    game.time_left = 0;

    // notify connected game sessions of it being over and frozen
    io.of("/site").in("game:"+game_id).emit("freeze_game",{
      game_id: game_id
    });

    // game is over and frozen, so close it soon
    setTimeout(function(){
      game.is_closed = true;
      game.overview = game.tiles = game.tile_order = game.users = null;
      game.rows = game.cols = game.tile_size = 0;

      // notify all users of the game closing
      io.of("/site").emit("close_game",{
        game_id: game_id
      });

      // remove the game images directory now that the game is fully closed
      rimraf("./games/" + game_id,function(){});
    },90*1000);
  }
}

function startGameClock(game_id) {
  var game = games[game_id];

  // push out update of game clock immediately
  io.of("/site").in("game:"+game_id).emit("game_clock",{
    time_left: game.time_left
  });

  if (!game.clock) {
    game.clock = setInterval(function(){
      if (game.in_play && !game.is_closed) {
        game.time_left = Math.max(0,game.time_left - 5);
        io.of("/site").in("game:"+game_id).emit("game_clock",{
          time_left: game.time_left
        });

        // game clock at 0, so expire game
        if (game.time_left === 0) {
          endGame(game_id);
        }
      }
      else {
        clearInterval(game.clock);
        game.clock = null;
      }
    },5*1000);
  }
}

function startGameMoveBroadcasts(game_id) {
  var game = games[game_id];

  if (!game.move_broadcast) {
    game.move_broadcast = setInterval(function(){
      if (Object.keys(games[game_id].moves).length > 0) {
        // tell all players of the movements of the tile as it's dragged
        io.of("/ww").in("game:"+game_id).emit("move_tile",{
          moves: games[game_id].moves
        });
        games[game_id].moves = {};
      }
    },333); // update interval for game tile moves
  }
}

function scoreTile(session_id,game_id) {
  var score = 0,
      num_tiles = Object.keys(games[game_id].tiles).length,
      num_tiles_left = 0
  ;

  score += (3 * num_tiles);

  for (var i in games[game_id].tiles) {
    if (games[game_id].tiles[i].position === null) num_tiles_left++;
  }

  score += (2 * num_tiles_left);

  users[session_id].score += score;
  if (users[session_id].score_update_notify) users[session_id].score_update_notify();
}


var global = this,
    httpserv = require("http").createServer(handleHTTP),
    io = require("/usr/local/lib/node_modules/socket.io").listen(httpserv),
    fs = require("fs"),
    rimraf = require("/usr/local/lib/node_modules/rimraf"),
    static = require("/usr/local/lib/node_modules/node-static"),
    fileServer = new static.Server("./games", {cache: 1200} ),

    sessions = {},
    game_sessions = {},
    users = {},
    user_ids = {},
    games = {},
    tiles = {},

    SERVER_ADDR = "174.120.72.139",
    SERVER_PORT = 80,

    TAKE_TRY_GAP = 300 // must keep a tile for this long (ms) before positioning
    TAKE_TRY_THROTTLE = 1100, // if you drop too quickly after take, throttle to this long (ms) after taking

    games_dir = fs.readdirSync("./games/")
;

// clear out the './games/' directory
for (var idx=0; idx<games_dir.length; idx++) {
  rimraf.sync("./games/" + games_dir[idx]);
}

httpserv.listen(SERVER_PORT, SERVER_ADDR);


io.configure(function(){
//  io.enable("browser client minification");  // send minified client
  io.enable("browser client etag");          // apply etag caching logic based on version number
  io.set("log level", 1);                    // reduce logging
  io.set("transports", [                     // enable all transports (optional if you want flashsocket)
      "websocket"
    , "flashsocket"
    , "htmlfile"
    , "xhr-polling"
    , "jsonp-polling"
  ]);
});


// site socket channel
io.of("/site").on("connection", function (socket) {
  var session_id, current_game_session_id;

  function leave_game(game_session_id) {
    var game_id, game;

    if (game_sessions[game_session_id] && 
      game_sessions[game_session_id].game_id
    ) {
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
          io.of("/site").in("game:"+game_id).emit("user_leave",{
            userid: users[session_id].userid
          });
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
        if (users[game.users[i]]) {
          list.push({
            userid: users[game.users[i]].userid,
            name: users[game.users[i]].name,
            score: users[game.users[i]].score
          });
        }
      }
    }
    return list;
  }

  function score_update_notify() {
    socket.emit("score_update",{score: users[session_id].score});
  }

  socket.on("validate_session", function(data) {
    if (data.session_id && !session_id) {
      session_id = data.session_id;
    }
    if (session_id && sessions[session_id]) {
      if (users[session_id]) {
        users[session_id].connected = true;
        users[session_id].score_update_notify = score_update_notify;
        socket.emit("session_valid", {session_id: session_id, user_info: users[session_id]} );
        socket.emit("score_update", {score: users[session_id].score} );
      }
      else {
        socket.emit("session_valid", {session_id: session_id, user_info: null} );
      }
    }
    else {
      session_id = new_session_id();
      sessions[session_id] = true;
      socket.emit("new_session", {session_id: session_id} );
    }
  });

  socket.on("login", function(data) {
    var resp = {};
    if (!session_id || !sessions[session_id]) {
      resp.new_session_id = session_id = new_session_id();
    }
    if (users[session_id]) {
      resp.already_logged_in = true;
      resp.name = users[session_id].name;
      resp.email = users[session_id].email;
      users[session_id].connected = true;
      users[session_id].score_update_notify = score_update_notify;
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
            users[session_id] = {
              userid: users[user_found].userid,
              name: users[user_found].name,
              email: users[user_found].email,
              connected: true,
              score: users[user_found].score,
              score_update_notify: score_update_notify
            };
            delete users[user_found];
            resp.login_successful = true;
          }
        }
        else {
          users[session_id] = {
            userid: new_user_id(),
            name: data.name,
            email: data.email,
            connected: true,
            score: 0,
            score_update_notify: score_update_notify
          };
          resp.login_successful = true;
        }
        if (users[session_id]) {
          resp.name = users[session_id].name;
          resp.email = users[session_id].email;
        }
      }
    }
    if (resp.error) {
      socket.emit("login_error", resp );
    }
    else {
      socket.emit("login_complete", resp );
      socket.emit("score_update", {score: users[session_id].score} );
    }

  });

  socket.on("disconnect", function() {
    if (users[session_id]) {
      users[session_id].connected = false;
      users[session_id].score_update_notify = false;
      if (current_game_session_id) leave_game(current_game_session_id);
    }
  });

  socket.on("logout", function(data,cb) {
    sessions[data.session_id] = false;
    if (users[data.session_id]) users[data.session_id].connected = false;
    cb();
    socket.emit("score_update", {score: ".."});
  });

  socket.on("list_games", function(data) {
    var game_ids = [];
    for (var i in games) {
      if (games[i].fully_created && !games[i].is_closed) {
        game_ids.push({
          game_id: i, 
          overview: games[i].overview.small
        });
      }
    }
    socket.emit("open_games", {games: game_ids} );
  });

  socket.on("join_game", function(data,cb) {
    var game_id = data.game_id;

    if (games[game_id] && games[game_id].users) {
      current_game_session_id = new_game_session_id();
      game_sessions[current_game_session_id] = {
        game_id: game_id, 
        session_id: session_id
      };
      cb(current_game_session_id);
      socket.emit("user_list", {list: game_user_list(game_id)} );

      games[game_id].users.push(session_id);
      socket.join("game:"+game_id);

      // notify all players of new user joining the game
      io.of("/site").in("game:"+game_id).emit("user_join", {
        userid: users[session_id].userid,
        name: users[session_id].name,
        score: users[session_id].score
      } );
    }
    else {
      socket.emit("game_error",{});
    }
  });

  socket.on("leave_game", function(data) {
    leave_game(data.game_session_id);
  });

  socket.on("create_game", function(data,cb) {
    var game_id = new_game_id(),
        game = games[game_id]
    ;

    game.fully_created = false;

    if (Object.keys(games).length > 500) {
      console.error("Too many games.");
      cb();
      return;
    }

    // if the count of tiles doesn't match what we expect, abort the game creation
    if (data.tiles.length != (data.rows * data.cols)) {
      console.error("Tile count mismatch.");
      cb();
      return;
    }
    for (var i=0; i<data.tiles.length; i++) {
      // if we don't recognize the data URL for any tile, abort the game creation
      if (!data.tiles[i].match(/^data:image\/[a-z]+;base64,/)) {
        console.error("Unrecognized data URL: "+data.tiles[i].substr(0,30));
        cb();
        return;
      }
    }

    // if we get this far, sanity checking has passed, so proceed to create the game
    fs.mkdir("./games/"+game_id,02770,function(err){
      if (err) { console.error(err); cb(); return; }
      fs.chmod("./games/"+game_id,02770,function(err){
        if (err) { console.error(err); cb(); return; }
        fs.chown("./games/"+game_id,1000,1000,function(err){
          if(err) { console.error(err); cb(); return; }
          game.overview = data.overview;
          game.is_closed = false;
          game.in_play = false;
          game.rows = data.rows;
          game.cols = data.cols;
          game.tile_size = data.tile_size;
          game.users = [];
          game.time_left = 60 * 20; // 20 minute game time limit
          game.moves = {};
          game.move_broadcast = null;

          scramble_tiles(game,data.tiles);

          global.$AG()
          .and(function(done){
            create_overview_image_files(game_id,/*errCB=*/cb).then(done);
          })
          .and(function(done){
            create_tile_image_files(game_id,/*errCB=*/cb).then(done);
          })
          .then(function(){
            game.fully_created = true;
            // if we return a game_id, the client knows the game was successfully created
            cb(game_id);

            // notify all users of a new game being available
            io.of("/site").emit("new_game",{
              game_id: game_id,
              overview: games[game_id].overview.small
            });
          });
        });
      });
    });
  });
});


// web worker socket channel
io.of("/ww").on("connection", function(socket) {
  var session_id, game_session_id, game_id;

  function resetTileAndUser(tile_id) {
      users[session_id].current_tile_id = null;
      delete games[game_id].moves[tile_id];
      games[game_id].tiles[tile_id].user_session_id = null;
      games[game_id].tiles[tile_id].available = true;
      games[game_id].tiles[tile_id].position = null;
      games[game_id].tiles[tile_id].taken = null;

      // reset the tile for all players
      io.of("/ww").in("game:"+game_id).emit("reset_tile", {tile_id: tile_id} );
      // reset this current player
      socket.emit("reset_player", {} );
  }

  socket.on("establish_game_session", function(data) {
    if (game_sessions[data.game_session_id] && 
      game_sessions[data.game_session_id].game_id
    ) {
      game_session_id = data.game_session_id;
      game_id = game_sessions[game_session_id].game_id;
      session_id = game_sessions[game_session_id].session_id;

      if (sessions[session_id] && 
        users[session_id] && 
        users[session_id].connected && 
        games[game_id] && 
        !games[game_id].is_closed &&
        games[game_id].fully_created
      ) {
        socket.join("game:"+game_id);

        // send game data to connected player
        socket.emit("game_session_valid", {
          overview: games[game_id].overview.big,
          tiles: games[game_id].tiles,
          rows: games[game_id].rows,
          cols: games[game_id].cols,
          tile_size: games[game_id].tile_size,
          in_play: (games[game_id].in_play || games[game_id].time_left)
        } );

        // first user to join the game? start the clock.
        if (!games[game_id].in_play && games[game_id].time_left) {
          games[game_id].in_play = true;

          // send out initial clock time
          io.of("/site").in("game:"+game_id).emit("game_clock",{
            time_left: games[game_id].time_left
          });

          // count down the game clock
          startGameClock(game_id);

          // set up the game move broadcast interval
          startGameMoveBroadcasts(game_id);
        }

        return;
      }
    }

    // if we get here, something's wrong with the game session, so bail
    socket.emit("game_session_invalid",{});
  });

  socket.on("take_tile", function(data,cb) {
    var tile_id = data.tile_id;

    if (games[game_id] && games[game_id].in_play) {
      if (users[session_id] && // user still valid?
        !users[session_id].current_tile_id // user doesn't currently have any tile?
      ) {
        users[session_id].current_tile_id = tile_id;

        if (games[game_id].tiles[tile_id] && // tile still valid?
          !games[game_id].tiles[tile_id].usser_session_id && // this tile is not assigned to any user?
          games[game_id].tiles[tile_id].available // tile is available
        ) {
          games[game_id].tiles[tile_id].user_session_id = session_id;
          games[game_id].tiles[tile_id].available = false;
          games[game_id].tiles[tile_id].position = null;
          games[game_id].tiles[tile_id].taken = (new Date()).getTime();

          cb(true);

          return;
        }
      }
    }

    // if we get here, the tile taking is not valid, so reject, then reset tile and user for good measure
    cb(false);
    resetTileAndUser(tile_id);
  });

  socket.on("try_tile_position", function(data) {
    function process_valid_tile_position() {
      users[session_id].current_tile_id = null;
      delete games[game_id].moves[tile_id];
      games[game_id].tiles[tile_id].user_session_id = null;
      games[game_id].tiles[tile_id].available = false;
      games[game_id].tiles[tile_id].position = position;
      games[game_id].tiles[tile_id].taken = null;

      // tell all players of the correctly positioned tile
      io.of("/ww").in("game:"+game_id).emit("position_tile", {tile_id: tile_id, position: position} );

      scoreTile(session_id,game_id);

      io.of("/site").in("game:"+game_id).emit("user_score", {
        userid: users[session_id].userid,
        name: users[session_id].name,
        score: users[session_id].score
      });

      checkGameTiles(game_id);
    }

    var tile_id = data.tile_id,
        position = data.position,
        now = (new Date()).getTime()
    ;

    if (games[game_id] && games[game_id].in_play && games[game_id].tiles[tile_id]) {
      if (users[session_id].current_tile_id == tile_id && // does the user have *this* tile?
        games[game_id].tiles[tile_id].user_session_id == session_id && // is the tile assigned to *this* user?
        games[game_id].tiles[tile_id].taken <= (now - TAKE_TRY_GAP) && // is the tile being positioned "long enough" after it was taken? (avoid agressive bots)
        games[game_id].tile_order[position] == tile_id // is the tile in the correct position?
      ) {
        if (games[game_id].tiles[tile_id].taken > (now - TAKE_TRY_THROTTLE)) { // throttle "fast drops" (slow aggressive bots down)
          setTimeout(process_valid_tile_position,
            (games[game_id].tiles[tile_id].taken + TAKE_TRY_THROTTLE - now)
          );
        }
        else { // tile position drop is ok to process right now
          process_valid_tile_position();
        }

        return;
      }

      // if we get here, the tile_position is not valid, so reset tile and user
      resetTileAndUser(tile_id);
    }
  });

  socket.on("move_tile", function(data) {
    var tile_id = data.tile_id,
        x = data.x,
        y = data.y
    ;

    if (games[game_id] && 
      games[game_id].tiles && 
      games[game_id].tiles[tile_id]
    ) {
      games[game_id].moves[tile_id] = {x: x, y: y};
    }
  });

  socket.on("reset_tile", function(data) {
    var tile_id = data.tile_id;

    if (games[game_id] && 
      games[game_id].tiles && 
      games[game_id].tiles[tile_id]
    ) {
      resetTileAndUser(tile_id);
    }
  });

  socket.on("disconnect", function(data) {
    // do we need to reset the disconnecting user's current tile?
    if (users[session_id] && // user still valid?
      games[game_id] && // game still valid?
      users[session_id].current_tile_id && // disconnecting user has a tile?
      games[game_id].tiles[users[session_id].current_tile_id] && // tile still valid?
      !games[game_id].tiles[users[session_id].current_tile_id].position // tile is not already correctly positioned?
    ) {
      games[game_id].tiles[users[session_id].current_tile_id].user_session_id = null;
      games[game_id].tiles[users[session_id].current_tile_id].position = null;
      games[game_id].tiles[users[session_id].current_tile_id].available = true;
      games[game_id].tiles[users[session_id].current_tile_id].taken = null;
    }

    session_id = game_session_id = game_id = null;
  });

});
