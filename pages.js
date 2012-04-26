// from PHP.js
// https://github.com/kvz/phpjs/
function htmlspecialchars(c,h,g,b){var e=0,d=0,f=false;if(typeof h==="undefined"||h===null){h=2}c=c.toString();if(b!==false){c=c.replace(/&/g,"&amp;")}c=c.replace(/</g,"&lt;").replace(/>/g,"&gt;");var a={ENT_NOQUOTES:0,ENT_HTML_QUOTE_SINGLE:1,ENT_HTML_QUOTE_DOUBLE:2,ENT_COMPAT:2,ENT_QUOTES:3,ENT_IGNORE:4};if(h===0){f=true}if(typeof h!=="number"){h=[].concat(h);for(d=0;d<h.length;d++){if(a[h[d]]===0){f=true}else{if(a[h[d]]){e=e|a[h[d]]}}}h=e}if(h&a.ENT_HTML_QUOTE_SINGLE){c=c.replace(/'/g,"&#039;")}if(!f){c=c.replace(/"/g,"&quot;")}return c}


(function(global,$){

	var MAX_FILE_SIZE = 200*1024, // 200k max file size
		MIN_IMG_WIDTH = 250, MIN_IMG_HEIGHT = 250,
		MAX_IMG_WIDTH = 650, MAX_IMG_HEIGHT = 650,
		FILEREADER_DEFINED = ("FileReader" in window)
	;

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
				gotoPage("login.html",null,false,
					"login.html?from=" + encodeURIComponent(current_href)
				);
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
				user_info = null;
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
			$("#content").html("<p>You are already logged in, " + 
				htmlspecialchars(user_info.name) + ".");
			handleLoggedInHeader();
		}
	}
	
	function closeGameInList(data) {
		$("#puzzles li[rel='"+data.game_id+"']").remove();
		if ($("#puzzles li").length === 0) {
			$("#puzzles").html("-none-");
		}
	}
	
	function addGame(data) {
		var $overview = $("<img />"),
			$a = $("<a></a>"), 
			$li = $("<li></li>")
		;

		$overview
		.attr({src: data.overview, border: 0});

		$a
		.attr({href: "play.html?puzzle="+data.game_id})
		.append($overview)

		$li
		.attr({rel:data.game_id})
		.append($a);

		if ($("#puzzles li").length === 0) $("#puzzles").empty();
		$("#puzzles").append($li);
	}
	
	function listGames(data) {
		if (data.games.length > 0) {
			$("#puzzles").empty();
			for (var i=0; i<data.games.length; i++) {
				addGame(data.games[i]);
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
	
	function generateTiles($preview_img,preview_img_type,tile_size) {
		var preview_img = $preview_img.get(0),
			img_width = $preview_img.width(), img_height = $preview_img.height(),
			$tile_canvas = $("<canvas />").attr({width:tile_size,height:tile_size}),
			context = $tile_canvas.get(0).getContext("2d"),
			x, y, tiles = []
		;
		context.fillStyle = "white";
		for (y=0; y<img_height; y+=tile_size) {
			for (x=0; x<img_width; x+=tile_size) {
				context.fillRect(0,0,tile_size,tile_size);
				context.drawImage(preview_img,
					x, y, tile_size, tile_size,
					0, 0, tile_size, tile_size
				);
				tiles.push($tile_canvas.get(0).toDataURL(preview_img_type));
			}
		}
		return tiles;
	}
	
	function generateGameOverviews($preview_img,preview_img_type) {
		var preview_img = $preview_img.get(0),
			img_width = $preview_img.width(), img_height = $preview_img.height(),
			max_small_width = 75, max_small_height = 75,
			max_overview_width = Math.floor(img_width * 0.5),
			max_overview_height = Math.floor(img_height * 0.5),
			$overview_canvas = $("<canvas />"), small_data, big_data,
			context = $overview_canvas.get(0).getContext("2d"),
			delta_width = img_width - max_overview_width,
			delta_height = img_height - max_overview_height,
			small_width, small_height, overview_width, overview_height
		;

		if (delta_width >= delta_height) {
			small_width = max_small_width;
			small_height = Math.floor(img_height / img_width * small_width);
			overview_width = max_overview_width;
			overview_height = Math.floor(img_height / img_width * overview_width);
		}
		else {
			small_height = max_small_height;
			small_width = Math.floor(img_width / img_height * small_height);
			overview_height = max_overview_height;
			overview_width = Math.floor(img_width / img_height * overview_height);
		}
		
		$overview_canvas.attr({width: small_width, height: small_height});
		context.drawImage(
			preview_img,
			0, 0, img_width, img_height,
			0, 0, small_width, small_height
		);
		small_data = $overview_canvas.get(0).toDataURL(preview_img_type);

		$overview_canvas.attr({width: overview_width, height: overview_height});
		context.drawImage(
			preview_img,
			0, 0, img_width, img_height,
			0, 0, overview_width, overview_height
		);
		big_data = $overview_canvas.get(0).toDataURL(preview_img_type);

		return {small: small_data, big: big_data};
	}

	// build the overlay grid on top of the preview image
	function buildPreviewGrid($preview_img,width,height,tile_size) {
		function drawGrid() {
			for (var x=tile_size; x<width; x+=tile_size) {
				context.rect(x-1,0,2,height);
			}
			for (var y=tile_size; y<height; y+=tile_size) {
				context.rect(0,y-1,width,2);
			}
		}

		var $preview_grid = $("<canvas />").attr({id:"preview_grid"}),
			context = $preview_grid.get(0).getContext("2d")
		;

		// set up the grid canvas
		$preview_grid
		.attr({width:width,height:height})
		.css({width:width+"px",height:height+"px"});

		context.save();
		// first, draw the grid to use a mask for the preview image
		context.beginPath();
		drawGrid();
		context.clip(); // turns the drawing into a mask

		// next, draw the preview image onto the canvas using the mask
		context.drawImage($preview_img.get(0),0,0);
		context.restore();

		// set composite mode for redrawing the grid on top of the preview image
		context.globalCompositeOperation = "lighter";
		context.globalAlpha = 0.7;

		// now, redraw the grid clipped preview image again, using the composite to lighten
		context.save();
		context.beginPath();
		drawGrid();
		context.clip(); // turns the drawing into a mask

		// redraw the preview image (masked by the grid) onto the canvas
		context.drawImage($preview_img.get(0),0,0);
		context.restore();

		return $preview_grid;
	}
	
	// process preview image, normalize size and re-render, then draw grid on top
	function processPreview(difficulty,$orig_preview_img) {
		var img_width = $orig_preview_img.width(), img_height = $orig_preview_img.height(),
			max_dimension, min_difficulty_tiles, tile_size,

			preview_img_type = $orig_preview_img.attr("data-img-type"),
			new_width = img_width, new_height = img_height,
			tiled_width, tiled_height,
			delta_width = img_width - MAX_IMG_WIDTH, delta_height = img_height - MAX_IMG_HEIGHT,
			img_x = 0, img_y = 0,
			img_ratio = 1,
			rows, cols,
			$canvas = $("<canvas />"), context = $canvas.get(0).getContext("2d"),
			$preview_container = $("#preview_container"),
			$preview_img = $("<img />").attr({id:"preview_img"})
		;

		// hide the container while we process and redo the preview image
		$preview_container.empty().css({"visibility":"hidden"});

		// is there overflow in either direction?
		if (delta_width > 0 || delta_height > 0) {
			// down-scale resize in the direction of the smallest difference, maintaining aspect ratio
			// resize horizontally?
			if (delta_width > 0 && delta_width >= delta_height) {
				new_width = MAX_IMG_WIDTH;
				img_ratio = new_width / img_width;
				new_height = Math.floor(img_height * img_ratio);
			}
			// otherwise, resize vertically?
			else if (delta_height > 0 && delta_height >= delta_width) {
				new_height = MAX_IMG_HEIGHT;
				img_ratio = new_height / img_height;
				new_width = Math.floor(img_width * img_ratio);
			}
		}

		max_dimension = Math.max(new_width,new_height);
		min_difficulty_tiles = (difficulty == "easy" ? 4 : (difficulty == "medium" ? 6 : 8)),
		tile_size = Math.max(30,Math.min(130,Math.floor(max_dimension / min_difficulty_tiles))),
		
		// snap dimensions (down) to tile_size (and max dimensions), via cropping
		tiled_width = new_width;
		tiled_height = new_height;
		if (tiled_width > MAX_IMG_WIDTH) {
			img_x = Math.floor(img_ratio * ((tiled_width - MAX_IMG_WIDTH) / 2));
			tiled_width = MAX_IMG_WIDTH;
		}
		else if (tiled_width % tile_size !== 0) {
			tiled_width = Math.floor(tiled_width / tile_size) * tile_size;
			img_x = Math.floor(img_ratio * ((new_width - tiled_width) / 2));
		}
		if (tiled_height > MAX_IMG_HEIGHT) {
			img_y = Math.floor(img_ratio * ((tiled_height - MAX_IMG_HEIGHT) / 2));
			tiled_height = MAX_IMG_HEIGHT;
		}
		else if (tiled_height % tile_size !== 0) {
			tiled_height = Math.floor(tiled_height / tile_size) * tile_size;
			img_y = Math.floor(img_ratio * ((new_height - tiled_height) / 2));
		}
		
		rows = tiled_height / tile_size;
		cols = tiled_width / tile_size;

		$canvas.attr({width:tiled_width,height:tiled_height});
		context = $canvas.get(0).getContext("2d");
		context.drawImage($orig_preview_img.get(0),
			img_x, img_y, tiled_width/img_ratio, tiled_height/img_ratio,
			0, 0, tiled_width, tiled_height
		);
		new_img_data = $canvas.get(0).toDataURL(preview_img_type);
		
		// update the preview image with the new image data
		$preview_img
		.bind("load",function(evt){
			$(this).unbind("load");

			$preview_grid = buildPreviewGrid($preview_img,tiled_width,tiled_height,tile_size);

			// save grid meta-data (used later during game upload)
			$preview_grid.attr({
				"data-rows": rows,
				"data-cols": cols,
				"data-tile-size": tile_size
			});

			$preview_container
			// overlay the grid on top of the preview image
			.append($preview_grid)
			// done processing the preview finally, so show it
			.css({"visibility":"visible"});

			// show the preview controls
			$("#preview_controls").show();

			// enable the game upload button now (if not yet enabled)
			$("#upload").removeAttr("disabled");
		})
		.attr({"src":new_img_data,"width":tiled_width,"height":tiled_height})
		.appendTo($preview_container);
	}

	// render initial preview image from file's image data
	function renderPreview(image_data,image_type) {
		var $orig_preview_img = $("<img />"),
			$preview_container = $("#preview_container"),
			$file_selector = $("#file_selector")
		;
			
		$preview_container.empty().css({"visibility":"hidden"});
		
		// draw preview image data into <img>
		$orig_preview_img
		.bind("load",function(evt){
			var img_width = $orig_preview_img.width(),
				img_height = $orig_preview_img.height()
			;
			
			$(this).unbind("load");
			
			// enforce minimum dimensions (note: no need to enforce max dimensions,
			// because we just down-scale)
			if (img_width < MIN_IMG_WIDTH || img_height < MIN_IMG_HEIGHT) {
				alert("The image dimensions must be at least " + MIN_IMG_WIDTH + 
					"x" + MIN_IMG_HEIGHT + ".");
				uploadReset();
			}
			// otherwise, image dimensions are OK
			else {
				// fire off preview image processing based on default difficulty level setting
				$("#difficulty_selector").trigger("change");
			}
		})
		.attr({id:"orig_preview_img",src:image_data,"data-img-type":image_type})
		.appendTo("#content");
	}

	// read image data from file
	function readFile(file) {
		// render the initial image preview with the dataURI
		function preview(dataURI) {
			$preview_container.empty();
			renderPreview(dataURI,file.type);
		}

		var $preview_container = $("#preview_container");
		
		$preview_container.html("Please wait...processing.");
		
		// is the local file access FileReader API defined?
		if (FILEREADER_DEFINED) {
			var reader = new FileReader();
			// listen for when file read has finished
			reader.onload = function(evt) {
				reader.onload = null;
				preview(evt.target.result);
			};

			// read the file, format read data as data-URL
			reader.readAsDataURL(file);
		}
		// otherwise, do xhr-upload workaround
		else {
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if (xhr.readyState == 4) {
					xhr.onreadystatechange = null;
					preview(xhr.responseText);
				}
			};
			xhr.open("POST", "get-data-uri/");
			xhr.setRequestHeader("Content-Type", "multipart/form-data");
			xhr.setRequestHeader("X-File-Name", file.name);
			xhr.setRequestHeader("X-File-Size", (file.size || file.fileSize));
			xhr.setRequestHeader("X-File-Type", file.type);
			xhr.send(file);
		}
	}

	function changeDifficulty() {
		// (re)process the preview with the current difficulty level setting
		processPreview($(this).val(),$("#orig_preview_img"));
	}
	
	function uploadGame($preview_img) {
		var preview_img_type = $preview_img.attr("data-img-type"),
			$preview_grid = $("#preview_grid"),
			rows = parseInt($preview_grid.attr("data-rows"),10),
			cols = parseInt($preview_grid.attr("data-cols"),10),
			tile_size = parseInt($preview_grid.attr("data-tile-size"),10),
			overview_img_data = generateGameOverviews($preview_img,preview_img_type),
			game_tiles = generateTiles($preview_img,preview_img_type,tile_size)
		;

		$("#file_selector").hide();
		$("#upload_reset").hide();
		$("#preview_container").html("Please wait...uploading.");
		$("#preview_controls").hide();

		socket.emit("create_game",{
			overview: overview_img_data,
			tiles: game_tiles,
			rows: rows,
			cols: cols,
			tile_size: tile_size
		},gameUploaded);
	}

	function gameUploaded(game_id) {
		if (game_id) {
			gotoPage("play.html",null,false,"play.html?puzzle="+game_id);
		}
		else {
			alert("An error occurred creating the game.");
			gameError();
		}
	}
	
	function gameError() {
		gotoPage("puzzles.html");
	}
	
	function userJoinGame(data) {
		var name = htmlspecialchars(data.name),
			score = htmlspecialchars(data.score),
			userid = data.userid,
			$li = $("<li>").attr({"data-user": userid}).html(name+": "+score);
		;
		$("#whosplaying").append($li);
	}
	
	function userLeaveGame(data) {
		var userid = data.userid;
		$("#whosplaying li[data-user='"+userid+"']").remove();
	}

	function userScore(data) {
		var name = htmlspecialchars(data.name),
			score = htmlspecialchars(data.score),
			userid = data.userid
		;
		$("#whosplaying li[data-user='"+userid+"']").html(name+": "+score);
	}
	
	function setGameClockTimer() {
		if (game_clock_interval) {
			clearInterval(game_clock_interval);
			game_clock_interval = null;
		}
		game_clock_interval = setInterval(function(){
			updateGameClock({time_left: (game_clock-1)});
		},1000);
	}
	
	function updateGameClock(data) {
		var minutes, seconds, clock_text = "";
		
		// clock hasn't been set yet, so do it
		if (game_clock == null) {
			game_clock = data.time_left;
			if (game_clock_interval) {
				clearInterval(game_clock_interval);
			}
			setGameClockTimer();
		}
		// don't make the clock go backwards... only update if lower
		else if (data.time_left < game_clock) {
			game_clock = data.time_left;
			
			// set timer if not currently set.
			if (!game_clock_interval) {
				setGameClockTimer();
			}
		}
		// clock is ahead/askew... wait/resync
		else {
			if (game_clock_interval) {
				clearInterval(game_clock_interval);
				game_clock_interval = null;
			}
			
			var clock_skew = data.time_left - game_clock;
			// should we adjust, or just wait for the next sync?
			if (clock_skew < 5) {
				setTimeout(function(){
					game_clock = data.time_left - clock_skew;
					setGameClockTimer();
				},clock_skew*1000);
			}
		}
		
		if (!$game_clock_text) $game_clock_text = $("#game_clock span");
		
		minutes = Math.floor(game_clock / 60);
		seconds = game_clock - (minutes * 60);
		
		if (minutes > 0) clock_text += minutes;
		clock_text += ":";
		if (seconds < 10) clock_text += "0";
		clock_text += seconds;
		
		$game_clock_text.text(clock_text);
	}
		
	function userList(data) {
		for (var i=0; i<data.list.length; i++) {
			userJoinGame(data.list[i]);
		}
	}

	function handleFileSelected(files) {
		// was at least one file selected?
		if (files.length) {
			// we only deal with one file!
			var file = files[0];

			// is file a recognized image type?
			if (file.type.match(/^image\/(?:png|gif|jpe?g)/)) {
				// is file within allowed size limit?
				// Gotcha: Chrome has `fileSize`, Firefox has `size`
				if ((file.fileSize || file.size) <= MAX_FILE_SIZE) {
					uploadPause();
					
					// read the file for previewing
					readFile(file);
				}
				else {
					alert("File size must be no greater than " + 
						Math.floor(MAX_FILE_SIZE / 1024) + "kb.");
					uploadReset();
				}
			}
			else {
				alert("Please select a recognized and web-compatible image (png/gif/jpg) file.");
				uploadReset();
			}
		}
	}

	function uploadPause() {
		$("#file_selector").attr({"disabled":"disabled"});
		$("#file_dropzone").hide();
	}

	function uploadReset() {
		$("#orig_preview_img").unbind("load").remove();
		$("#file_selector").val("").removeAttr("disabled");
		$("#file_dropzone").removeClass("okdrop nodrop").show();
		$("#preview_container").empty().css({"visibility":"visible"});
		$("#preview_controls").hide();
	}

	function isFileDragEvent(types) {
		function isMozEvent(types) {
			for (var idx in types) { if (types.hasOwnProperty(idx)) {
				if (types[idx].match(/^application\/x-moz/)) return true;
			}}
			return false;
		}

		var evtType = isMozEvent(types) ? "application/x-moz-file" : "Files";
		return ((types.contains) ? types.contains(evtType) : types.indexOf(evtType) != -1);
	}

	function dragFileAccept(evt) {
		var $file_dropzone = $(this);

		if (evt.originalEvent.dataTransfer.types && 
			isFileDragEvent(evt.originalEvent.dataTransfer.types)
		) {
			evt.originalEvent.dataTransfer.dropEffect = "copy";
			$file_dropzone.removeClass("nodrop").addClass("okdrop");
		}
		else {
			evt.originalEvent.dataTransfer.dropEffect = "none";
			$file_dropzone.removeClass("okdrop").addClass("nodrop");
		}

		evt.stopPropagation();
		evt.preventDefault();
		return false;
	}

	function dragFileReject(evt) {
		evt.originalEvent.dataTransfer.dropEffect = "none";
		$("#file_dropzone").removeClass("okdrop nodrop");

		evt.stopPropagation();
		evt.preventDefault();
		return false;
	}

	function dragFileLeave(evt) {
		$("#file_dropzone").removeClass("okdrop nodrop");
	}

	function dropFileAccept(evt) {
		$(this).removeClass("okdrop nodrop");
		handleFileSelected(evt.originalEvent.dataTransfer.files);

		evt.preventDefault();
		evt.stopPropagation();
		return false;
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
		$game_clock_text,
		game_clock,
		game_clock_interval,
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
					$file_selector.unbind("change");
					$("body").unbind("dragover dragend");
					$file_dropzone.unbind("dragleave dragover dragenter drop");
					$difficulty_selector.unbind("change");
					$upload.unbind("click");
					$upload_reset.unbind("click");
				});

				var $file_selector = $("#file_selector"),
					$file_dropzone = $("#file_dropzone"),
					$difficulty_selector = $("#difficulty_selector"),
					$upload = $("#upload"),
					$upload_reset = $("#upload_reset")
				;

				uploadReset();

				$file_selector.bind("change",function(){
					handleFileSelected(this.files);
				});

				$("body")
				.bind("dragover", dragFileReject);
				$file_dropzone
				.bind("dragover dragenter", dragFileAccept)
				.bind("dragleave", dragFileLeave)
				.bind("drop", dropFileAccept);

				$difficulty_selector.bind("change",changeDifficulty);

				$upload.bind("click",function(){
					if (!$(this).is(":disabled")) {
						$(this).attr({"disabled":"disabled"});
						uploadGame($("#preview_img"));
					}
				});

				$upload_reset.click(uploadReset);
			},
			
			
			"play.html":function() {
				var current_game_session_id;
				
				if (!session_id || !user_info) return login_needed("play.html");
				
				$game_clock_text = game_clock = null;
				
				if (socket) {
					// clean up after ourself later
					registerPageUnloadHandler(function(){
						if (game_clock_interval) {
							clearInterval(game_clock_interval);
							game_clock_interval = null;
						}
						
						if (socket) {
							socket.removeListener("close_game",closeCurrentGame);
							socket.removeListener("game_error",gameError);
							socket.removeListener("user_list",userList);
							socket.removeListener("user_join",userJoinGame);
							socket.removeListener("user_score",userScore);
							socket.removeListener("user_leave",userLeaveGame);
							socket.removeListener("game_clock",updateGameClock);
							socket.removeListener("freeze_game",freezeGameClock);
							
							if (game_id) {
								socket.emit("leave_game",{
									game_session_id: current_game_session_id
								});
							}
						}
						quitGame();
						$game_clock_text = game_clock = null;
					});
					
					socket.on("close_game",closeCurrentGame);
					socket.on("game_error",gameError);
					socket.on("user_list",userList);
					socket.on("user_join",userJoinGame);
					socket.on("user_score",userScore);
					socket.on("user_leave",userLeaveGame);
					socket.on("game_clock",updateGameClock);
					socket.on("freeze_game",freezeGameClock);
					
					var parts = parseUri(location.href), game_id;
					
					if (parts.queryKey && parts.queryKey["puzzle"]) {
						game_id = parts.queryKey["puzzle"];
						
						if (!play_code) {
							play_code = $LAB.script("play.js?_="+Math.random());
						}

						socket.emit("join_game",{game_id:game_id},function(game_session_id){
							current_game_session_id = game_session_id;
							play_code.wait(function(){
								playGame(game_session_id);
							});
						});
					}
					else gameError({});

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
				socket = io.connect(site_socket+"/site");
				
				window.addEventListener("unload", function(){
					clearTimeout(disconnect_timeout);
				},false);
				
				socket.on("disconnect", function(data) {
					socket = null;
					clearTimeout(disconnect_timeout);
					// use a timeout to delay the disconnection notice in case of navigation/reload
					disconnect_timeout = setTimeout(function(){
						logout();
					},750);
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
						// run the login check in a moment
						if (is_func(check)) setTimeout(check,0);
						return false;
					}
				}
				break;
		}
		return true;
	};
	
	global.freezeGameClock = function() {
		clearInterval(game_clock_interval);
		game_clock_interval = null;
		$("#game_clock span").text(":00 (game over!)");
		freezeGamePlay();
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