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
        games[gameId] = {players: [], chess: new Chess()};
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
        socket.emit('joinGame', games[gameId]['players']);
        var playerId = playerOf(socket);
        var player = {playerId: playerId, name: joinReq.playerName, color: nextColor(games[gameId]['players'].length)};
        socket.emit('youAre', player);
        games[gameId]['players'].push(player);
        socket.join(gameId);
        io.to(gameId).emit('playerJoined', player);
    });
    socket.on('startGame', (msg) => {
      var gameId = gameOf(socket);
      if (!(gameId in games)) {
          socket.emit('startGame', 'notfound');
          return;
      }
      console.log('game start: ' + gameId);
      io.to(gameId).emit('startGame', gameId);
    });
    socket.on('moveRequest', (moveReq) => {
      console.log('moveRequest: ' + JSON.stringify(moveReq));
      var gameId = gameOf(socket);
      if (!(gameId in games)) {
          socket.emit('moveRequest', 'notfound');
          return;
      }
      try {
      var game = chessOf(socket);
      var move = game.move({from:moveReq.from, to:moveReq.to, promotion:'q'}); // promotion:'q' to always try to promote to a queen for simplicity
        io.to(gameId).emit('playerMoved', {move: move, player:playerOf(socket)});
        if (game.isGameOver()) {
          io.to(gameId).emit('endGame', endGameReason(game));
        }
      } catch (err) {
        socket.emit('moveRequestDenied', {from:moveReq.from, to:moveReq.to, validBoard: chessOf(socket).fen()});
      } 
    });
  });

server.listen(3000, () => {
  console.log('listening on *:3000');
});



function nextColor(playerId) {
  return (playerId % 2) ? 'b' : 'w';
}
function playerOf(sc) {
  return Array.from(sc.rooms)[0];
}
function gameOf(sc) {
  return Array.from(sc.rooms)[1];
}
function chessOf(sc) {
  return  games[gameOf(sc)]['chess'];
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