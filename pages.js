// from PHP.js
// https://github.com/kvz/phpjs/
function htmlspecialchars(c,h,g,b){var e=0,d=0,f=false;if(typeof h==="undefined"||h===null){h=2}c=c.toString();if(b!==false){c=c.replace(/&/g,"&amp;")}c=c.replace(/</g,"&lt;").replace(/>/g,"&gt;");var a={ENT_NOQUOTES:0,ENT_HTML_QUOTE_SINGLE:1,ENT_HTML_QUOTE_DOUBLE:2,ENT_COMPAT:2,ENT_QUOTES:3,ENT_IGNORE:4};if(h===0){f=true}if(typeof h!=="number"){h=[].concat(h);for(d=0;d<h.length;d++){if(a[h[d]]===0){f=true}else{if(a[h[d]]){e=e|a[h[d]]}}}h=e}if(h&a.ENT_HTML_QUOTE_SINGLE){c=c.replace(/'/g,"&#039;")}if(!f){c=c.replace(/"/g,"&quot;")}return c}


(function(global,$){
		  
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
	
	function login_needed() {
		function checkLoginReq() {
			if (session_id && !user_info) {
				var current_href = location.href.replace(/^.*?\/([\w0-9\-_]+\.html)/,"$1");
				gotoPage("login.html",null,false,"login.html?from="+encodeURIComponent(current_href));
			}
		}
		
		if (current_page != "login.html") {
			if (session_id && !user_info) checkLoginReq();
			else if (!session_id) {
				socket_queue.push(checkLoginReq);
			}
		}
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
			
			socket.emit("login", {session_id:session_id, name:name, email:email} );
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
	
	function previewImage(file) {
		$("#img_preview").html("Please wait...uploading.");
		
		var reader = new FileReader();
		reader.onload = function(e){
			$("#img_preview").empty();
			
			if (file.fileSize <= (1024*100)) { // 100kb max image size
				var image_contents = e.target.result;
				var $img = $("<img />").attr({"src":image_contents});
				$("#img_preview").append($img);
				
				$("#upload").removeAttr("disabled").bind("click",function(){
					$(this).attr({"disabled":"disabled"});
					uploadImage(image_contents);
				});
			}
			else {
				alert("Image size must be no greater than 100kb.");
				$("#file_selector").removeAttr("disabled");
			}
		};
		reader.readAsDataURL(file);
	}
	
	function uploadImage(img) {
		socket.emit("upload_image",{dataURL:img},function(game_id){
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




	var session_id = retrieveSessionId(),
		session_initialized = false,
		socket_queue = [],
		socket_timeout,
		pleasewait_timeout,
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
					if (files_array[0].type.match(/image/)) { // it's an image file
						previewImage(files_array[0]);
						
						$file_selector.attr({"disabled":"disabled"}); // disable the file selector (for now)
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
						}
					});
					
					socket.on("close_game",closeCurrentGame);
					
					socket.on("game_info",loadGame);
					
					socket.on("game_error",gameError);
					
					var parts = parseUri(location.href),
						game_id
					;
		
					if (parts.queryKey && parts.queryKey["puzzle"]) {
						game_id = parts.queryKey["puzzle"];
						socket.emit("load_game",{game_id:game_id});
					}
					else {
						gameError({});
					}
				}
			}
		}
	;

	global.initSession = function() {
		session_initialized = true;
		
		if (typeof global["io"] != "undefined" && io.connect) {
			clearTimeout(socket_timeout);
			socket = io.connect("http://xx.yy.zz.ww");
			
			socket.on("disconnect", function(data) {
				socket = null;
				logout();
			});
			
			socket.on("session_valid", function(data) {
				clearTimeout(pleasewait_timeout);
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
					if (current_page != "index.html") { // login necessary beyond homepage!
						login_needed();
					}
				}
			});
			
			socket.on("new_session", function(data) {
				clearTimeout(pleasewait_timeout);
				$("#pleasewait").hide();
				session_id = data.session_id;
				saveSessionId(session_id);
				processSocketQueue();
				if (current_page != "index.html") { // login necessary beyond homepage!
					login_needed();
				}
			});
			
			socket.on("score_update", function(data) {
				$("#score").html(data.score);
			});
			
			socket.emit("validate_session", {session_id:session_id} );
		}
		else {
			$("#connection_failed").show();
		}
	};
	
	global.handlePageLoad = function(page) {
		function doHandler() {
			if (handlers[page]) handlers[page]();
		}
		
		current_page = page;
		if (!session_initialized) {
			initSession();
			socket_queue.push(doHandler);
		}
		else {
			doHandler();
		}
	};
	
	$(document).ready(function(){
		$("#logout").bind("click",handleLogout);
	});

	socket_timeout = setTimeout(function(){
		$("#pleasewait").hide();
		$("#connection_failed").show();
		pageLoaded();
	},3000);
	
	pleasewait_timeout = setTimeout(function(){
		$("#pleasewait").show();
	},200);
})(window,jQuery);