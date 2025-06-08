const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static('./'));

// Store waiting players
let waitingPlayers = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinWaitingRoom', () => {
    console.log('Player joined waiting room:', socket.id);
    console.log('Current waiting players:', waitingPlayers);
    
    // Add player to waiting room
    waitingPlayers.push(socket.id);
    console.log('Updated waiting players:', waitingPlayers);
    
    // Notify player they joined waiting room
    socket.emit('waitingRoomJoined');
    
    // If we have 2 or more players, match them
    if (waitingPlayers.length >= 2) {
      console.log('Found enough players to start a game!');
      
      // Get first two players
      const player1 = waitingPlayers.shift();
      const player2 = waitingPlayers.shift();
      
      console.log('Matching players:', { player1, player2 });
      
      // Create a unique room ID
      const roomId = `room_${player1}_${player2}`;
      console.log('Created room:', roomId);
      
      // Get both socket instances
      const player1Socket = io.sockets.sockets.get(player1);
      const player2Socket = io.sockets.sockets.get(player2);
      
      if (!player1Socket || !player2Socket) {
        console.error('One or both player sockets not found!');
        return;
      }
      
      // Create room and add players
      player1Socket.join(roomId);
      player2Socket.join(roomId);
      console.log('Both players joined room:', roomId);
      
      // Assign X to first player, O to second player
      player1Socket.emit('gameFound', {
        roomId: roomId,
        playerSymbol: 'X'
      });
      console.log('Sent X to player 1');
      
      player2Socket.emit('gameFound', {
        roomId: roomId,
        playerSymbol: 'O'
      });
      console.log('Sent O to player 2');
      
      // Notify both players game is starting
      io.to(roomId).emit('gameStart', { roomId: roomId });
      console.log('Game start notification sent to room:', roomId);
    } else {
      console.log('Waiting for more players...');
    }
  });

  socket.on('makeMove', ({ roomId, index, symbol }) => {
    console.log('Move made:', { roomId, index, symbol, by: socket.id });
    // Broadcast move to other player in the room
    socket.to(roomId).emit('opponentMove', { index, symbol });
  });

  socket.on('gameEnd', ({ roomId, winner, gameState }) => {
    console.log('Game ended:', { roomId, winner });
    // Broadcast game end to other player
    socket.to(roomId).emit('gameOver', { winner, gameState });
  });

  // Add chat message handler
  socket.on('chatMessage', ({ roomId, message }) => {
    console.log('Chat message received:', { roomId, message, sender: socket.id });
    io.to(roomId).emit('chatMessage', { message, sender: socket.id });
  });

  socket.on('restartGame', ({ roomId }) => {
    console.log('Restart game requested:', { roomId, player: socket.id });
    // Broadcast restart to other player in the room
    socket.to(roomId).emit('gameRestart');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    console.log('Current waiting players before removal:', waitingPlayers);
    
    // Remove player from waiting room if they were waiting
    waitingPlayers = waitingPlayers.filter(id => id !== socket.id);
    console.log('Updated waiting players after removal:', waitingPlayers);
    
    // Notify other player if they were in a game
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        console.log('Notifying room about disconnection:', room);
        socket.to(room).emit('playerDisconnected');
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});