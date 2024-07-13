const path = require('path')

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const { Chess } = require('chess.js');

app.use('/', express.static(path.join(__dirname, 'static')));

var games = {};

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('createGame', () => {
        var gameId = (Math.round(Math.random()*100000)).toString();
        games[gameId] = {players: [], votes: [], state: 'pending', chess: new Chess()};
        console.log('createGame: ' + gameId);
        socket.emit('createGame', gameId)
        socket.join(gameId);
    });
    socket.on('joinGame', (joinReq) => {
        var gameId = joinReq.gameId;
        if (!(gameId in games)) {
            socket.emit('joinGame', 'notfound');
            return;
        }
        console.log('joinGame: ' + gameId);
        socket.emit('joinGame', games[gameId].players);
        var playerId = playerIdOf(socket);
        var player = {playerId: playerId, name: joinReq.playerName, color: nextColor(games[gameId].players.length)};
        socket.emit('youAre', player);
        games[gameId].players.push(player);
        socket.join(gameId);
        io.to(gameId).emit('playerJoined', player);
        if (gameOf(socket).state == 'started') {
          io.to(gameId).emit('startGame', chessOf(socket).fen());
        }
    });
    socket.on('startGame', () => {
      console.log('startGame');
      var gameId = gameIdOf(socket);
      if (!(gameId in games)) {
          socket.emit('startGame', 'notfound');
          return;
      }
      gameOf(socket).state = 'started';
      console.log('game start: ' + gameId);
      io.to(gameId).emit('startGame', chessOf(socket).fen());
    });
    socket.on('voteOnMove', (moveReq) => {
      console.log('voteOnMove: ' + JSON.stringify(moveReq));
      var gameId = gameIdOf(socket);
      if (!(gameId in games)) {
          socket.emit('voteOnMove', 'notfound');
          return;
      }
      try {
        var mygame = new Chess(chessOf(socket).fen());
        var move = mygame.move({from:moveReq.from, to:moveReq.to, promotion:'q'}); // promotion:'q' to always try to promote to a queen for simplicity
        var vote = {move: move, player:playerIdOf(socket)};
        gameOf(socket).votes.push(vote);
        io.to(gameId).emit('playerVoted', vote);
      } catch (err) {
        socket.emit('voteOnMoveDenied', {from:moveReq.from, to:moveReq.to, validBoard: chessOf(socket).fen()});
      }
    });
    socket.on('groupElections', (reason) => {
      console.log('groupElections');
      var gameId = gameIdOf(socket);
      if (!(gameId in games)) {
          socket.emit('groupElections', 'notfound');
          return;
      }
      var game = chessOf(socket);
      console.log(`elections on game ${gameId} group ${game.turn()}`);
      var elected = majorityVotes(socket);
      game.move(elected.move);
      gameOf(socket).votes = [];
      io.to(gameId).emit('groupElectedMove', elected);
      if (game.isGameOver()) {
        gameOf(socket).state = 'ended';
        io.to(gameId).emit('endGame', endGameReason(game));
      }
    });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});



function nextColor(playerId) {
  return (playerId % 2) ? 'b' : 'w';
}
function playerIdOf(sc) {
  return Array.from(sc.rooms)[0];
}
function gameIdOf(sc) {
  return Array.from(sc.rooms)[1];
}
function gameOf(sc) {
  return games[gameIdOf(sc)];
}
function chessOf(sc) {
  return  games[gameIdOf(sc)].chess;
}
function endGameReason(game) {
  if (game.isCheckmate()) {
    return 'checkmate';
  } else if (game.isStalemate()) {
    return 'stalemate';
  } else if (game.isDraw()) {
    return 'draw';
  } else if (game.isThreefoldRepetition()) {
    return 'threefold_repetition';
  } else if (game.isInsufficientMaterial()) {
    return 'insufficient_material';
  }
}
function majorityVotes(sc) {
  var votes = gameOf(sc).votes; 
  if (votes.length == 0) { return {move: chessOf(sc).moves()[0], decidingPlayers: ['random']}; } // pick the first legal move, assumes not isGameOver
  var elections = {};
  var electedMoves = {};
  for (var vote of votes) {
    if (!(vote.move.lan in elections)) {
      elections[vote.move.lan] = [];
    }
    elections[vote.move.lan].push(vote.player);
    electedMoves[vote.move.lan] = vote.move;
  }
  var decidingPlayers = [];
  var decidedMove = '';
  for (const [electedMove, electingPlayers] of Object.entries(elections)) {
    if (electingPlayers.length > decidingPlayers.length) {
      decidingPlayers = electingPlayers;
      decidedMove = electedMove;
    }
  }
  return {move: electedMoves[decidedMove], decidingPlayers: decidingPlayers};
}