var app = require('http').createServer(function(req, res){
    res.writeHead(200);
    res.end("Nothing to see here. Check out <a href='http://test.getify.com/wepuzzleit/'>We Puzzle It!</a>");
  }),
  io = require('/usr/local/lib/node_modules/socket.io').listen(app),
  sessions = {},
  users = {},
  games = {}
;

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

app.listen(80, "xx.yy.zz.ww");

io.configure(function(){
  io.enable('browser client minification');  // send minified client
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

io.sockets.on('connection', function (socket) {
  var session_id;

  socket.on('validate_session', function(data) {
    if (data.session_id && sessions[data.session_id]) {
      socket.emit('session_valid', {session_id:data.session_id, user_info:users[data.session_id]||null} );
      if (users[data.session_id]) socket.emit('score_update', {score:users[data.session_id].score} );
    }
    else {
      session_id = new_session_id();
      sessions[session_id] = true;
      socket.emit('new_session', {session_id: session_id} );
    }
  });

  socket.on('login', function(data) {
    var resp = {};
    if (!data.session_id || !sessions[data.session_id]) {
      resp.new_session_id = data.session_id = new_session_id();
    }
    session_id = data.session_id;
    if (users[session_id]) {
      resp.already_logged_in = true;
      resp.name = users[session_id].name;
      resp.email = users[session_id].email;
    }
    else {
      if (!data.name || data.name.length < 2) resp.error = "First name must be 2 or more characters.";
      else if (!data.email || data.email.length < 6 || !(data.email.indexOf("@") > 0)) resp.error = "Email must be valid.";
      else {
        var user_found = false, user_connected = false;
        for (var i in users) {
          if (i != session_id && users[i] && users[i].name.toLowerCase() == data.name.toLowerCase() && users[i].email.toLowerCase() == data.email.toLowerCase()) {
            user_found = i;
            user_connected = users[i].connected;
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
      socket.emit('login_error',resp);
    }
    else {
      socket.emit('score_update', {score:users[session_id].score} );
      socket.emit('login_complete', resp );
    }

  });

  socket.on('disconnect', function() {
    if (users[session_id]) users[session_id].connected = false;
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

  socket.on('upload_image', function(data,cb) {
    var game_id = new_game_id();
    games[game_id].is_closed = false;
    games[game_id].img = data.dataURL;
    cb(game_id);
    socket.broadcast.emit("new_game", {"game_id":game_id} );

    setTimeout(function(){ 
      games[game_id].is_closed = true;
      games[game_id].img = null;
      socket.broadcast.emit("close_game", {"game_id":game_id} );
    },1000*120); // games expire after 2 minutes 
  });

  socket.on('load_game', function(data) {
    if (games[data.game_id] && !games[data.game_id].is_closed && games[data.game_id].img) {
      socket.emit("game_info", {dataURL:games[data.game_id].img} );
    }
    else {
      socket.emit("game_error", {game_id:data.game_id} );
    }
  });

});
