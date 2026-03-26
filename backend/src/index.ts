// backend/src/index.ts
import express from 'express';
import type { Express, Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

// Express app setup
const app: Express = express();
app.use(cors());
app.use(express.json());

// HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // React frontend
    methods: ['GET', 'POST'],
  },
});

const connectedUsers = new Set<string>();

// Socket.IO events
io.on('connection', (socket: Socket) => {
  console.log('New client connected:', socket.id);
  connectedUsers.add(socket.id);

  io.emit('users_update', connectedUsers.size);

  socket.on('key_down', (key: string) => {
    console.log(`Key pressed by ${socket.id}: ${key}`);
    socket.broadcast.emit('key_down', key); // send to everyone except sender
  });

  socket.on('key_up', (key: string) => {
    console.log(`Key let go by ${socket.id}: ${key}`);
    socket.broadcast.emit('key_up', key); // send to everyone except sender
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    connectedUsers.delete(socket.id);
    io.emit('users_update', connectedUsers.size);
  });
});

// Test REST endpoint
app.get('/', (req: Request, res: Response) => {
  res.send('Rock Band backend running!');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
