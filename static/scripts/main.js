/**********************************
     Initialize
***********************************/

var socket = io();
var TURN_MAX_MILISECONDS = 3 * 60 * 1000; // todo
var board = null
var gameId = null;
var player = {};
var publicScreen = true;
var canVote = false;
var game_turn = '';



/**********************************
     Button actions
***********************************/

function requestJoinGame() {
  $('#publicMainLobby').hide();
  $('#privateJoinGame').show();
}
function startNewGame() {
  publicScreen = true;
  socket.emit('createGame', 'createGame');
}
function joinGame() {
  publicScreen = false;
  var joinGameReq = {gameId: $('#join_game_id').val(), playerName: $('#join_player_name').val()};
  socket.emit('joinGame', joinGameReq );
}
function startGame() {
  socket.emit('startGame', '' );
}
function groupVote() {
  socket.emit('groupElections', 'requested' );
}



/**********************************
     UI event listeners
***********************************/

function onDragStart (source, piece, position, orientation) {
  if (!canVote) { 
    return false;
  }
  if ((game_turn === 'w' && piece.search(/^b/) !== -1) ||
      (game_turn === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onDrop (source, target) {
  if (game_turn != player.color) { 
    return 'snapback';
  }
  socket.emit('voteOnMove', {
    from: source,
    to: target
  });
  canVote = false;
}




/**********************************
     WebSocket event listeners
***********************************/
socket.on('createGame', function(gameId) {
    $('#publicMainLobby').hide();
    $('#publicWaitForStart').show();
    $('.gameId').html(gameId);
    new QRCode(document.getElementById("qrcode"), {
      text: window.location + '#' + gameId,
      width: 128,
      height: 128,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });
});
socket.on('joinGame', function(players) {
  if (players === 'notfound') {
    $('#privateJoinGameNotFound').show();
    $('#privateJoinGameNotFound').hide(2000);
    return;
  }
  $('#privateJoinGame').hide();
  $('#privateWaitForStart').show();
  for (pl of players) {
    showJoinedPlayer(pl);
  }
  gameId = msg;
  $('.gameId').html(gameId);
});
socket.on('youAre', function(msg) {
  player = msg;
});
socket.on('startGame', function(fen) {
  $('#privateWaitForStart').hide();
  $('#publicWaitForStart').hide();
  $('.turn_of_b').hide();
  $('.turn_of_w').show();
  game_turn = 'w';
  if (publicScreen) {
    $('#publicGameRoom').show();
    var config = {
      draggable: false,
      position: fen
    }
    board = Chessboard('publicBoard', config);
  } else {
    $('#privateGameRoom').show();
    var config = {
      orientation: player['color'] == 'b' ? 'black' : 'white',
      draggable: true,
      position: fen,
      onDragStart: onDragStart,
      onDrop: onDrop
      //,onSnapEnd: onSnapEnd
    }
    board = Chessboard('privateBoard', config);
    $('#privateStatus_'+player['color']).show();
    $('.players_' + (player['color']=='b'?'w':'b')).hide();
    canVote = game_turn == player['color'];
  }
});
socket.on('voteOnMoveDenied', function(moveReq) {
  // if this is a private screen and my move and it is not valid - snap back
  board.position(moveReq.validBoard)
  canVote = game_turn == player['color'];
});
socket.on('groupElectedMove', function(elected) {
  board.position(elected.move.after)
  if (elected.move.color == 'w') {
    game_turn = 'b';
    $('.turn_of_w').hide();
    $('.turn_of_b').show();
  } else {
    game_turn = 'w';
    $('.turn_of_b').hide();
    $('.turn_of_w').show();
  }
  board.position(elected.move.after);
  canVote = !publicScreen && (game_turn == player['color']);

});
socket.on('endGame', function(reason) {
  game_turn = '';
  $('.turn_of_w').hide();
  $('.turn_of_b').hide();
  $('.game_ended').show();
  $('.game_end_reason').text(reason);
});

socket.on('playerJoined', function(playerJoined) {
  showJoinedPlayer(playerJoined);
});
function showJoinedPlayer(playerJoined) {
  var playerJoined_html = `<span class="player">${playerJoined.name}</span>`;
  $('.players_' + playerJoined.color).append(playerJoined_html);
}

/**********************************
     debugger
***********************************/
socket.on("connect", () => {
  const engine = socket.io.engine;
  engine.on("packet", ({ type, data }) => {
    // called for each packet received
    $("#debugger").prepend("<span class='packet'>Got: "+type+(data?(': '+ data):'')+'</span>');
  });
  engine.on('packetCreate', ({ type, data }) => {
    // Log the packet type and data
    $("#debugger").prepend("<span class='packet'>Sending: "+type+(data?(': '+ data):'')+'</span>');
  });
});


/**********************************
     init
***********************************/

if (window.location.hash) {
  $('#publicMainLobby').hide();
  $('#privateJoinGame').show();
  $('#join_game_id').val(window.location.hash.replace('#',''))
}
