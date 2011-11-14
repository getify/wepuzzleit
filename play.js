// simple WebWorkers shim
(function(global){
	var index = 0;
	if (!("Worker" in global)) {
		global.Worker = function(src){
			var publicAPI,
				worker,
				worker_idx = index++,
				queue = []
			;
			
			// set up the fake worker environment instance	
			Worker["__"+worker_idx] = worker = {
				postMessage: function(msg) {
					var fn = function(){ publicAPI.onmessage(msg); };
					if (queue===false) setTimeout(fn,0);
					else queue.push(fn);
				},
				onmessage: function(){}
			};
			
			var xhr = (XMLHttpRequest ? new XMLHttpRequest() : global.ActiveXObject("Microsoft.XMLHTTP"));
			xhr.onreadystatechange = function() {
				if (xhr.readyState == 4) {
					var script_src = "(function(self,importScripts){\n" + xhr.responseText + "\n})(Worker['__"+worker_idx+"'],function(){});",
						script = document.createElement("script"), fn
					;
					script.text = script_src;
					(document.body || document.getElementsByTagName("body")[0]).appendChild(script);

					while (fn = queue.shift()) fn();
					queue = true;
				}
			};
			xhr.open("GET",src);
			xhr.send("");
			
			publicAPI = {
				postMessage: function(msg) {
					var fn = function(){ worker.onmessage(msg); };
					if (queue !== true) queue.push(fn);
					else setTimeout(fn,0);
				},
				onmessage: function(){},
				terminate: function(){}
			};
			
			return publicAPI;
		};
	}
	else {
		delete global.Worker; // make sure to roll back the global native Worker to its pristine state
	}
})(window);




// *******************************************************************************



(function(global){
		  
	function build_gameboard(tiles,rows,cols,tile_size) {
		var $board = $("<div />").attr("id","gameboard"),
			$tiles = $("<div />").attr("id","tiles"),
			$table = $("<table />").attr({id:"grid","cellspacing":"0","cellpadding":"0","border":"0"}),
			$tile = $("<div />"), $img = $("<img />"),
			$td, $tr, i, cl
		;
				
		$table.html("<tr><td><span></span></td></tr>");
		$tr = $table.find("tr");
		$td = $tr.find("td");
		
		for (i=0; i<(cols-1); i++) {
			$tr.append($td.clone());
		}
		for (i=0; i<(rows-1); i++) {
			$table.append($tr.clone());
		}
		i = 0;
		cl = "dark";
		$table.find("span").each(function(){
			cl = (cl == "dark") ? "light" : "dark";
			$(this).css({width:tile_size+"px",height:tile_size+"px"}).addClass(cl);
			i++;
			if (cols % 2 == 0 && i % cols == 0) cl = (cl == "dark") ? "light" : "dark";
		});
		
		for (i in tiles) {
			$img.attr({"data-tile-id":i,"src":tiles[i].data});
			$tiles.append($img);
			$img = $("<img />");
		}
		
		$board.append($table);
		
		$("#game").empty().append($tiles).append($board);
	}

	global.playGame = function(session_id,game_id) {
		global.GameWorker = new Worker("ww.js");
		global.GameWorker.onmessage = function(evt) {
			if (evt.data.error) {
				alert("Error: "+evt.data.error);
			}
			else if (evt.data.preview) {
				var $img = $("<img />").attr({src:evt.data.preview});
				$("#game_preview").append($img).show();
			}
			else if (evt.data.tiles) {
				build_gameboard(evt.data.tiles,evt.data.rows,evt.data.cols,evt.data.tile_size);
			}
			else {
				alert(evt.data);
			}
		};
		global.GameWorker.postMessage({messageType:"start", session_id:session_id,game_id:game_id}); // start the worker
	};
	
	global.quitGame = function() {
		try { global.GameWorker.terminate(); } catch (err) { }
		global.GameWorker = null;
	};

})(window);