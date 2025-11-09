const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000; // Server listens on port 3000

// Store drawing operations on the server
let allOperations = [];
const connectedUsers = new Map(); // To store user details like color

// Use CORS (optional, but good for development if client is on a different port)
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Basic route to serve index.html (though express.static handles this for '/')
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Assign a random color to the new user and store it
  const userColor = '#' + Math.floor(Math.random()*16777215).toString(16);
  connectedUsers.set(socket.id, { color: userColor });

  // Send initial state to the new client
  socket.emit('init', { operations: allOperations });

  // Update user count for everyone
  io.emit('users', io.engine.clientsCount);

  // Handle drawing events (client emits 'draw')
  socket.on('draw', (data) => {
    allOperations.push(data); // Store the operation
    socket.broadcast.emit('draw', data); // Broadcast to all other connected clients
  });

  // Handle cursor movement (client emits 'cursor')
  socket.on('cursor', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) { // Ensure user exists in map
      socket.broadcast.emit('cursor', { userId: socket.id, userColor: user.color, x: data.x, y: data.y });
    }
  });

  // Handle undo
  socket.on('undo', (data) => {
    // Find and remove the operation from allOperations
    const index = allOperations.findIndex(op => op.id === data.operationId);
    if (index !== -1) {
      allOperations.splice(index, 1);
      io.emit('redraw', { operations: allOperations }); // Tell everyone to redraw
    }
  });

  // Handle clear
  socket.on('clear', () => {
    allOperations = [];
    io.emit('clear'); // Tell everyone to clear
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    connectedUsers.delete(socket.id); // Remove user from map
    io.emit('userDisconnected', socket.id); // Notify others to remove cursor
    io.emit('users', io.engine.clientsCount); // Update user count
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
