// from PHP.js
// https://github.com/kvz/phpjs/
function htmlspecialchars(c,h,g,b){var e=0,d=0,f=false;if(typeof h==="undefined"||h===null){h=2}c=c.toString();if(b!==false){c=c.replace(/&/g,"&amp;")}c=c.replace(/</g,"&lt;").replace(/>/g,"&gt;");var a={ENT_NOQUOTES:0,ENT_HTML_QUOTE_SINGLE:1,ENT_HTML_QUOTE_DOUBLE:2,ENT_COMPAT:2,ENT_QUOTES:3,ENT_IGNORE:4};if(h===0){f=true}if(typeof h!=="number"){h=[].concat(h);for(d=0;d<h.length;d++){if(a[h[d]]===0){f=true}else{if(a[h[d]]){e=e|a[h[d]]}}}h=e}if(h&a.ENT_HTML_QUOTE_SINGLE){c=c.replace(/'/g,"&#039;")}if(!f){c=c.replace(/"/g,"&quot;")}return c}


(function(global,$){
		  
	function is_func(func) { return (Object.prototype.toString.call(check) == "[object Function]"); }
		  
	function processSocketQueue() {
		while (socket_queue.length) {
			(socket_queue.shift())();
		}
	}
	
	function retrieveSessionId() {
		var sid = sessionStorage.getItem("session_id");
		if (sid) return sid;
		return null;
	}
	
	function saveSessionId(sid) {
		sessionStorage.setItem("session_id",sid);
	}
	
	function forgetSessionId() {
		sessionStorage.removeItem("session_id");
	}
	
	function saveUserInfo(uinfo) {
		localStorage.setItem("user_info",JSON.stringify(uinfo));
	}
	
	function retrieveUserInfo() {
		var uinfo = localStorage.getItem("user_info");
		if (uinfo) return JSON.parse(uinfo);
		return {};
	}
	
	function forgetUserInfo() {
		localStorage.removeItem("user_info");
	}
	
	// TODO: hook this up to an interval that checks for site updates (for example, every 20 minutes)
	function updateAppcache(){
		var cache = applicationCache;
		cache.update(); // check to see if the cache manifest file has been updated

		cache.addEventListener("updateready", function(){
			if (cache.status == cache.UPDATEREADY) {
				if (confirm("This site has been updated. Do you want to reload?")) {
					location.reload();
				}
			}
		}, false);
	}
	
	function login_needed(page,defer) {
		function checkLoginReq() {
			if (!session_id || !user_info) {
				var current_href = location.href.replace(/^.*?\/([\w0-9\-_]+\.html)/,"$1");
				gotoPage("login.html",null,false,"login.html?from="+encodeURIComponent(current_href));
			}
		}
		
		if (page != "login.html" && page != "index.html") {
			if (session_check_complete) {
				if (!defer) {
					checkLoginReq();
					return true;
				}
				else return checkLoginReq;
			}
			else {
				socket_queue.push(checkLoginReq);
				return true;
			}
		}
		return false;
	}
	
	function login_complete(data) {
		if (data.new_session_id) {
			session_id = data.new_session_id;
		}
		if (data.already_logged_in) {
			user_info = user_info || {};
			user_info.name = data.name;
			user_info.email = data.email;
		}
		else {
			user_info = {name:data.name, email:data.email};
		}
		
		saveUserInfo(user_info);
		
		handleLoggedInHeader();
		
		var matches = location.href.match(/[#?&]{0,2}from=([^&]+)/),
			redirectHref
		;
		if (matches && matches[1]) {
			redirectHref = decodeURIComponent(matches[1]);
			gotoPage(getPageName(redirectHref),null,false,redirectHref);
		}
		else {
			gotoPage("index.html");
		}
	}
	
	function login_error(data) {
		if (data.new_session_id) {
			session_id = data.new_session_id;
		}
		
		alert(data.error);
	}
	
	function handleLoginFormSubmit(evt) {
		evt.preventDefault();
		
		if (socket) {
			registerPageUnloadHandler(function(){
				if (socket) {
					socket.removeListener("login_complete",login_complete);
					socket.removeListener("login_error",login_error);
				}
			});
			
			socket.on("login_complete",login_complete);
			
			socket.on("login_error",login_error);
			
			var $form = $("#login_form"),
				name = $form.children("input[name='first_name']").val(),
				email = $form.children("input[name='email']").val()
			;
			
			socket.emit("login",{name:name, email:email});
		}
		else {
			$("#connection_failed").show();
		}

		return false;
	}
	
	function handleLogout(evt) {
		evt.preventDefault();
		forgetUserInfo();
		forgetSessionId();
		logout();
		return false;
	}
	
	function logout() {
		if (session_id && user_info) {
			if (current_page == "index.html") {
				$(".step1").css({"text-decoration":"none"});
			}
			else {
				gotoPage("index.html");
			}
			if (socket) {
				try { 
					socket.emit("logout", {session_id:session_id}, function(){
						socket.emit("validate_session", {} );
					});
				} catch (err) {}
			}
			else {
				$("#connection_failed").show();
			}
			session_id = user_info = null;
			handleLoggedInHeader();
		}
		else {
			handleLoggedInHeader();
		}
		
		return false;
	}
	
	function handleLoggedInHeader() {
		if (session_id && user_info) {
			$("#your_name").html(htmlspecialchars(user_info.name));
			$("#logged_in").show();
		}
		else {
			$("#your_name").html("");
			$("#logged_in").hide();
		}
	}
	
	function overrideLoginForm() {
		if (current_page == "login.html") {
			runPageUnloadHandlers();
			$("#content").html("<p>You are already logged in, "+htmlspecialchars(user_info.name)+".");
			handleLoggedInHeader();
		}
	}
	
	function closeGameInList(data) {
		$("#puzzles li[rel='"+data.game_id+"']").remove();
		if ($("#puzzles li").length == 0) {
			$("#puzzles").html("-none-");
		}
	}
	
	function addGame(data) {
		var $a = $("<a></a>").attr({"href":"play.html?puzzle="+data.game_id}).html("#"+data.game_id),
			$li = $("<li></li>").attr({"rel":data.game_id}).append($a)
		;
		if ($("#puzzles li").length == 0) $("#puzzles").empty();
		$("#puzzles").append($li);
	}
	
	function listGames(data) {
		if (data.games.length > 0) {
			$("#puzzles").empty();
			for (var i=0; i<data.games.length; i++) {
				addGame({game_id:data.games[i]});
			}
		}
	}
	
	function closeCurrentGame(data) {
		var parts = parseUri(location.href);
		
		// this current game closed!
		if (parts.queryKey && parts.queryKey["puzzle"] == data.game_id) {
			gotoPage("puzzles.html");
		}
	}
	
	function generateTiles(img,imgtype,tile_size) {
		var $img = $(img), width = $img.width(), height = $img.height(),
			$tile_canvas = $("<canvas />").attr({width:tile_size,height:tile_size}),
			context = $tile_canvas.get(0).getContext("2d"),
			x, y, tiles = []
		;
		
		for (y=0; y<height; y+=tile_size) {
			for (x=0; x<width; x+=tile_size) {
				context.drawImage(img,x,y,tile_size,tile_size,0,0,tile_size,tile_size);
				tiles.push($tile_canvas.get(0).toDataURL(imgtype));
			}
		}
		return tiles;
	}
	
	function generatePreview(img,imgtype) {
		var $img = $(img),
			$preview_canvas = $("<canvas />").attr({width:"150",height:"150"}),
			context = $preview_canvas.get(0).getContext("2d")
		;
		context.drawImage(img,0,0,$img.width(),$img.height(),0,0,150,150);
		return $preview_canvas.get(0).toDataURL(imgtype);
	}
	
	function processImage($img,imgtype,processingDone) {
		var $canvas = $("<canvas />"),
			context,
			img_width = $img.width(), img_height = $img.height(),
			tiled_img_data,
			new_width = img_width, new_height = img_height,
			tiled_width, tiled_height,
			min_width = 250, min_height = 250, // TODO: use a constant for min-image-size
			max_width = 600, max_height = 600,
			delta_width = img_width - max_width, delta_height = img_height - max_height,
			img_x = 0, img_y = 0,
			img_ratio = 1,
			tile_size = 50,
			cols = min_width / tile_size
		;

		// is there overflow in either direction?
		if (delta_width > 0 || delta_height > 0) {
			// down-scale resize in the direction of the smallest difference, maintaining aspect ratio
			// resize horizontally?
			if (delta_width > 0 && (delta_height <= 0 || delta_width <= delta_height)) {
				new_width = max_width;
				img_ratio = new_width / img_width;
				new_height = img_height * img_ratio;
			}
			// otherwise, resize vertically?
			else if (delta_height > 0 && (delta_width <= 0 || delta_height <= delta_width)) {
				new_height = max_height;
				img_ratio = new_height / img_height;
				new_width = img_width * img_ratio;
			}
		}
		
		// snap dimensions (down) to tile_size (and max dimensions), via cropping
		tiled_width = new_width;
		tiled_height = new_height;
		if (tiled_width > max_width) {
			img_x = Math.floor(img_ratio * ((tiled_width - max_width) / 2));
			tiled_width = max_width;
		}
		else if (tiled_width % tile_size != 0) {
			tiled_width = Math.floor(tiled_width / tile_size) * tile_size;
			img_x = Math.floor(img_ratio * ((new_width - tiled_width) / 2));
		}
		if (tiled_height > max_height) {
			img_y = Math.floor(img_ratio * ((tiled_height - max_height) / 2));
			tiled_height = max_height;
		}
		else if (tiled_height % tile_size != 0) {
			tiled_height = Math.floor(tiled_height / tile_size) * tile_size;
			img_y = Math.floor(img_ratio * ((new_height - tiled_height) / 2));
		}
		
		rows = tiled_height / tile_size;
		cols = tiled_width / tile_size;
		
		$canvas.attr({width:tiled_width,height:tiled_height});
		context = $canvas.get(0).getContext("2d");
		context.drawImage($img.get(0),img_x,img_y,tiled_width/img_ratio,tiled_height/img_ratio,0,0,tiled_width,tiled_height);
		new_img_data = $canvas.get(0).toDataURL(imgtype);
		
		$img
		.unbind("load")
		.attr({"src":""})
		.bind("load",function(evt){
			processingDone(generatePreview(this,imgtype),generateTiles(this,imgtype,tile_size),rows,cols,tile_size);
		}).attr({"src":new_img_data,"width":tiled_width,"height":tiled_height});
	}
	
	function viewImage(file) {
		
		var reader = new FileReader(),
			$img_view_container = $("#img_view_container"),
			$file_selector = $("#file_selector")
		;
		
		$img_view_container.html("Please wait...processing.");
		
		reader.onload = function(e){
			$img_view_container.empty();
			
			// Gotcha: Chrome uses `fileSize`, Firefox uses `size`
			if ((file.fileSize || file.size) <= (1024*150)) { // 150kb max image size
				var image_contents = e.target.result,
					$img = $("<img />")
				;
					
				$img_view_container.css({"visibility":"hidden"});
				
				$img
				.bind("load",function(evt){
					// draw image onto a <canvas>
					var img_width = $img.width(), img_height = $img.height();
					
					// enforce minimum dimensions
					if (img_width < 250 || img_height < 250) { // TODO: use a constant for min-image-size
						alert("The image dimensions must be at least 200x200.");
						$img_view_container.empty().css({"visibility":"visible"});
						$file_selector.val("").removeAttr("disabled"); // reset the file selector
						return;
					}
					
					processImage($img,file.type,function(preview_img_data,img_tiles,rows,cols,tile_size){
						var $preview_img = $("<img />").attr({src:preview_img_data}),
							$tiles_holder = $("<div>"),
							$tile_img
						;
						
						$img_view_container.css({"visibility":"visible"});
						
						$("#upload").removeAttr("disabled").bind("click",function(){
							$(this).attr({"disabled":"disabled"});
							uploadImage(preview_img_data,img_tiles,rows,cols,tile_size);
						});
						
					});
					
				})
				.attr({"src":image_contents}).appendTo($img_view_container);
				
			}
			else {
				alert("Image size must be no greater than 150kb.");
				$file_selector.val("").removeAttr("disabled"); // reset the file selector
			}
		};
		reader.readAsDataURL(file);
	}
	
	function uploadImage(preview_img_data,img_tiles,rows,cols,tile_size) {
		socket.emit("upload_image",{preview:preview_img_data,tiles:img_tiles,rows:rows,cols:cols,tile_size:tile_size},function(game_id){
			gotoPage("play.html",null,false,"play.html?puzzle="+game_id);
		});
	}
	
	function loadGame(data) {
		var $img = $("<img />").attr({"src":data.dataURL});
		$("#game").empty().append($img);
	}
	
	function gameError(data) {
		gotoPage("puzzles.html");
	}
	
	function userJoinGame(data) {
		var name = htmlspecialchars(data.name),
			$li = $("<li>").attr({"data-user":name}).html(name)
		;
		$("#whosplaying").append($li);
	}
	
	function userLeaveGame(data) {
		var name = htmlspecialchars(data.name);
		$("#whosplaying li[data-user='"+name+"']").remove();
	}
	
	function userList(data) {
		for (var i=0; i<data.list.length; i++) {
			userJoinGame({name:data.list[i]});
		}
	}




	var session_id = retrieveSessionId(),
		session_initialized = false,
		session_check_complete = false,
		play_code = false,
		socket_queue = [],
		socket_timeout,
		current_page,
		user_info,
		socket,
		handlers = {
			"index.html":function() {
				// welcome home
				if (session_id && user_info) {
					$(".step1").css({"text-decoration":"line-through"});
				}
				else {
					$(".step1").css({"text-decoration":"none"});
				}
			},
			
			
			"login.html":function() {
				// user already logged in, show "logout" content instead
				if (session_id && user_info) {
					overrideLoginForm();
					return;
				}
				
				var uinfo = retrieveUserInfo();
				if (uinfo.name) {
					$("#login_form input[name='first_name']").val(uinfo.name);
				}
				if (uinfo.email) {
					$("#login_form input[name='email']").val(uinfo.email);
				}
				
				// this login was forced
				if (location.href.match(/[#?&]{0,2}from=.+$/)) {
					alert("You must login first!");
				}
				
				// clean up after ourself later
				registerPageUnloadHandler(function(){
					$("#login_form").unbind("submit",handleLoginFormSubmit);
				});
				
				// handle the login form submission
				$("#login_form").bind("submit",handleLoginFormSubmit);
				
				if (session_id) {
					$("#login_form input[type='submit']").removeAttr("disabled");
				}
			},
			
			
			"puzzles.html":function() {
				if (!session_id || !user_info) return login_needed("puzzles.html");
				
				if (socket) {
					// clean up after ourself later
					registerPageUnloadHandler(function(){
						if (socket) {
							socket.removeListener("close_game",closeGameInList);
							socket.removeListener("open_games",listGames);
							socket.removeListener("new_game",addGame);
						}
					});
				
					socket.on("close_game",closeGameInList);
					socket.on("open_games",listGames);
					socket.on("new_game",addGame);
					
					socket.emit("list_games",{});
				}
			},
			
			
			"new-puzzle.html":function() {
				if (!session_id || !user_info) return login_needed("new-puzzle.html");
				
				registerPageUnloadHandler(function(){
					$("#file_selector").unbind("change");
					$("#upload").unbind("click");
				});

				var $file_selector = $("#file_selector");

				$file_selector.bind("change",function(){
					var files_array = this.files;

					// we only allowed one file to be selected
					if (files_array.length) {
						if (files_array[0].type.match(/image/)) { // it's an image file
							viewImage(files_array[0]);
						
							$file_selector.attr({"disabled":"disabled"}); // disable the file selector (for now)
						}
						else {
							alert("Please select a recognized image file.");
							$file_selector.val("");
						}
					}
				});
			},
			
			
			"play.html":function() {
				if (!session_id || !user_info) return login_needed("play.html");
				
				if (socket) {
					// clean up after ourself later
					registerPageUnloadHandler(function(){
						if (socket) {
							socket.removeListener("close_game",closeCurrentGame);
							socket.removeListener("game_info",loadGame);
							socket.removeListener("game_error",gameError);
							socket.removeListener("user_list",userList);
							socket.removeListener("user_join",userJoinGame);
							socket.removeListener("user_leave",userLeaveGame);
							
							if (game_id) {
								socket.emit("leave_game",{game_id:game_id});
							}
						}
						quitGame();
					});
					
					socket.on("close_game",closeCurrentGame);
					socket.on("game_info",loadGame);
					socket.on("game_error",gameError);
					socket.on("user_list",userList);
					socket.on("user_join",userJoinGame);
					socket.on("user_leave",userLeaveGame);
					
					var parts = parseUri(location.href), game_id;
					
					if (parts.queryKey && parts.queryKey["puzzle"]) {
						game_id = parts.queryKey["puzzle"];
						socket.emit("join_game",{game_id:game_id});
					}

					if (!play_code) {
						play_code = $LAB.script("play.js");
					}
					
					play_code.wait(function(){
						if (game_id) {
							playGame(session_id,game_id);
						}
						else {
							gameError({});
						}
					});
				}
			}
		}
	;

	global.initSession = function() {
		var disconnect_timeout;
		
		if (!session_initialized) {
			session_initialized = true;
			
			if (typeof global["io"] != "undefined" && io.connect) {
				clearTimeout(socket_timeout);
				socket = io.connect(main_socket);
				
				window.addEventListener("unload", function(){
					clearTimeout(disconnect_timeout);
				},false);
				
				socket.on("disconnect", function(data) {
					socket = null;
					clearTimeout(disconnect_timeout);
					disconnect_timeout = setTimeout(function(){	// use a timeout to suppress the disconnection notice in case of navigation/reload
						logout();
					},500);
				});
				
				socket.on("session_valid", function(data) {
					session_check_complete = true;
					$("#pleasewait").hide();
					if (data.user_info) {
						user_info = data.user_info;
						processSocketQueue();
						if (current_page == "login.html") {
							overrideLoginForm();
						}
						else {
							if (current_page == "index.html" && session_id && user_info) {
								$(".step1").css({"text-decoration":"line-through"});
							}
							handleLoggedInHeader();
						}
					}
					else {
						processSocketQueue();
						login_needed(current_page);
					}
				});
				
				socket.on("new_session", function(data) {
					session_check_complete = true;
					$("#pleasewait").hide();
					session_id = data.session_id;
					saveSessionId(session_id);
					processSocketQueue();
					login_needed(current_page);
				});
				
				socket.on("score_update", function(data) {
					$("#score").html(data.score);
				});
				
				socket.emit("validate_session", {session_id:session_id} );
			}
			else {
				$("#connection_failed").show();
			}
		}
	};
	
	global.handlePageLoad = function(page) {
		function doHandler() {
			if (handlers[page]) handlers[page]();
		}
		
		current_page = page;
		if (!session_check_complete) {
			initSession();
			socket_queue.push(doHandler);
		}
		else {
			doHandler();
		}
	};
	
	global.pagePreCheck = function(page) {
		switch (page) {
			case "play.html":
			case "puzzles.html":
			case "new-puzzle.html":
				if (!session_id || !user_info) {
					var check = login_needed(page,true);
					if (check !== false) {
						if (is_func(check)) setTimeout(check,0); // run the login check in a moment
						return false;
					}
				}
				break;
		}
		return true;
	};
	
	$(document).ready(function(){
		$("#logout").bind("click",handleLogout);
		
		if (!socket) {
			socket_timeout = setTimeout(function(){
				$("#pleasewait").hide();
				$("#connection_failed").show();
				pageLoaded();
			},5000);
		}
	});

})(window,jQuery);