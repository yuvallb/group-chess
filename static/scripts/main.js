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

function joinGameForm() {
  $('#publicMainLobby').hide();
  $('#privateJoinGame').show();
}
function createGameRequest() {
  publicScreen = true;
  socket.emit('createGameRequest', 'createGame');
}
function joinGameRequest() {
  publicScreen = false;
  var joinGameReq = {gameId: $('#join_game_id').val(), playerName: $('#join_player_name').val()};
  socket.emit('joinGameRequest', joinGameReq );
}
function startGameRequest() {
  socket.emit('startGameRequest', '' );
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
socket.on('createGame', function(gId) {
  gameId = gId;
    $('#publicMainLobby').hide();
    $('#publicWaitForStart').show();
    $('.gameId').html(gameId);
    showQrCode("qrcode", gameId);
    showQrCode("qrcode2", gameId);
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
});
socket.on('youAreGameId', function(gId) {
  gameId = gId;
  $('.gameId').html(gameId);
});
socket.on('youArePlayer', function(pl) {
  player = pl;
});
socket.on('startGame', function(fen) {
  $('#privateWaitForStart').hide();
  $('#publicWaitForStart').hide();
  game_turn = turnOf(fen); // game can start in b if joining in the middle
  $('.turn_of_'+otherColor(game_turn)).hide();
  $('.turn_of_'+game_turn).show();
  if (publicScreen) {
    $('#publicGameRoom').show();
    var config = {
      draggable: false,
      position: fen
    }
    board = Chessboard('publicBoard', config);
    $("#refreshPublicLink").attr("href", "#public" + gameId);
  } else {
    $('#privateGameRoom').show();
    var config = {
      orientation: player['color'] == 'b' ? 'black' : 'white',
      draggable: true,
      position: fen,
      onDragStart: onDragStart,
      onDrop: onDrop
    }
    board = Chessboard('privateBoard', config);
    $('#privateStatus_' + player['color']).show();
    $('.players_' + otherColor(player['color'])).hide();
    canVote = game_turn == player['color'];
  }
});
socket.on('voteOnMoveDenied', function(moveReq) {
  board.position(moveReq.validBoard)
  canVote = game_turn == player['color'];
});
socket.on('playerVoted', function(vote) {
  $('.'+vote.player).addClass('voted');
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
  $('.voted').removeClass('voted');
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
  var playerJoined_html = `<span class="player ${playerJoined.playerId}">${playerJoined.name}</span>`;
  $('.players_' + playerJoined.color).append(playerJoined_html);
}
function turnOf(fen) {
  return fen.split(' ')[1];
}
function otherColor(c) {
  return c=='b'?'w':'b';
}
function showQrCode(eId, gId) {
  new QRCode(eId, {
    text: window.location.href.split('#')[0] + '#' + gId,
    width: 128,
    height: 128,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });
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
  if (window.location.hash.indexOf('public')>-1) {
    publicScreen = true;
    gameId = window.location.hash.replace('#','').replace('public','');
    $('#publicMainLobby').hide();
    $('.gameId').html(gameId);
    showQrCode("qrcode", gameId);
    showQrCode("qrcode2", gameId);
    socket.emit('startGameRequest', gameId);  
  } else {
    publicScreen = false;
    gameId = window.location.hash.replace('#','');
    $('#publicMainLobby').hide();
    $('#privateJoinGame').show();
    $('#join_game_id').val(gameId);
  }
}
