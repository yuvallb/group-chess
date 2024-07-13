/**********************************
     Initialize
***********************************/

var socket = io();
var TURN_MAX_MILISECONDS = 3 * 60 * 1000;
var board = null
var gameId = null;
var player = {};
var publicScreen = true;
//var game = new Chess()
var game_turn = '';
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')



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
  socket.emit('startGame', gameId );

}

/**********************************
     UI event listeners
***********************************/

function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  //if (game.game_over()) return false

  // only pick up pieces for the side to move
//   if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
//       (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
//     return false
//   }
  if ((game_turn === 'w' && piece.search(/^b/) !== -1) ||
      (game_turn === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onDrop (source, target) {
  if (game_turn != player.color) { 
    return 'snapback';
  }
  socket.emit('moveRequest', {
    from: source,
    to: target
  });
}




/**********************************
     WebSocket event listeners
***********************************/
socket.on('createGame', function(msg) {
    $('#publicMainLobby').hide();
    $('#publicWaitForStart').show();
    $('.gameId').html(msg);
    gameId = msg;
});
socket.on('joinGame', function(msg) {
  if (msg == 'notfound') {
    $('#privateJoinGameNotFound').show();
    $('#privateJoinGameNotFound').hide(2000);
    return;
  }
  $('#privateJoinGame').hide();
  $('#privateWaitForStart').show();
  $('.gameId').html(msg);
  gameId = msg;
});
socket.on('youAre', function(msg) {
  player = msg;
});
socket.on('startGame', function(msg) {
  $('#privateWaitForStart').hide();
  $('#publicWaitForStart').hide();
  $('.turn_of_b').hide();
  $('.turn_of_w').show();
  game_turn = 'w';
  if (publicScreen) {
    $('#publicGameRoom').show();
    var config = {
      draggable: false,
      position: 'start'
    }
    board = Chessboard('publicBoard', config);
  } else {
    $('#privateGameRoom').show();
    var config = {
      orientation: player['color'] == 'b' ? 'black' : 'white',
      draggable: true,
      position: 'start',
      onDragStart: onDragStart,
      onDrop: onDrop
      //,onSnapEnd: onSnapEnd
    }
    board = Chessboard('privateBoard', config);
    $('#privateStatus_'+player['color']).show();
  }
});
socket.on('moveRequestDenied', function(moveReq) {
  // if this is a private screen and my move and it is not valid - snap back
  board.position(moveReq.validBoard)
});
socket.on('playerMoved', function(moveReq) {
// this should be "groupMoved":
  board.move(`${moveReq.move.from}-${moveReq.move.to}`)
  if (moveReq.move.color == 'w') {
    game_turn = 'b';
    $('.turn_of_w').hide();
    $('.turn_of_b').show();
  } else {
    game_turn = 'w';
    $('.turn_of_b').hide();
    $('.turn_of_w').show();
  }
  // on public screen:
  //    show that player voted
  //    
  // on private screen:
  //    draw small board after move
  // 
});
socket.on('nextTurn', function(msg) {
  
  // on public screen:
  //    update board and status
  //    start timer
  setTimeout(()=>socket.emit('turnTimeout','turnTimeout'), TURN_MAX_MILISECONDS);
  //
  // on private screen:
  //    update board and status
  //    if this is the players turn : allow moving
  // 
});
socket.on('endGame', function(reason) {
  game_turn = '';
  $('.turn_of_w').hide();
  $('.turn_of_b').hide();
  $('.game_ended').show();
  $('.game_end_reason').text(reason);
});
  
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
     logic
***********************************/

function updateStatus () {
  var status = ''

  var moveColor = 'White'
  if (game.turn() === 'b') {
    moveColor = 'Black'
  }

  // checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.'
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position'
  }

  // game still on
  else {
    status = moveColor + ' to move'

    // check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check'
    }
  }
  $status.html(status)
  $fen.html(game.fen())
  $pgn.html(game.pgn())
}




/**********************************
     Activate board - remove from here, should be "on demand"
***********************************/



