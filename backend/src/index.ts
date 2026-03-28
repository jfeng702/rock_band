// backend/src/index.ts
import express from 'express';
import type { Express, Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import 'dotenv/config'; // if using ESM
import { connectDB } from './db/index.ts';
import { User } from './models/User.ts';

// Express app setup
const app: Express = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await connectDB();

    // HTTP server
    const server = http.createServer(app);

    // Socket.IO setup
    const io = new Server(server, {
      cors: {
        origin: [process.env.FRONTEND_URL || '', 'http://localhost:5173'], // React frontend
        methods: ['GET', 'POST'],
      },
    });

    const connectedUsers = new Set<string>();

    const clientInstruments: Record<string, string> = {}; // socketId -> instrument

    // Socket.IO events
    io.on('connection', async (socket: Socket) => {
      console.log('New client connected:', socket.id);
      console.log(socket.handshake.headers);
      connectedUsers.add(socket.id);

      // Get client IP
      const ip =
        socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      const userAgent = socket.handshake.headers['user-agent']; // <-- get User-Agent

      // Save user to MongoDB
      try {
        await User.create({
          socketId: socket.id,
          connectedAt: new Date(),
          ip: ip as string,
          userAgent: userAgent as string,
        });

        console.log('User saved in DB:', socket.id);
      } catch (err) {
        console.error('Failed to save user:', err);
      }

      // Send the current instrument of 1st other client to new client
      socket.emit('change_instrument', Object.values(clientInstruments)[0]);

      io.emit('users_update', connectedUsers.size);

      socket.on(
        'note_down',
        ({ note, instrument1 }: { note: string; instrument1: string }) => {
          console.log(`Note pressed by ${socket.id}: ${note}`);
          console.log(instrument1, 'instrument1');
          socket.broadcast.emit('note_down', { note, instrument1 }); // send to everyone except sender
        },
      );

      socket.on(
        'note_up',
        ({ note, instrument1 }: { note: string; instrument1: string }) => {
          console.log(`Note let go by ${socket.id}: ${note}`);
          socket.broadcast.emit('note_up', { note, instrument1 }); // send to everyone except sender
        },
      );

      socket.on('change_instrument', (instrument) => {
        clientInstruments[socket.id] = instrument;

        socket.broadcast.emit('change_instrument', instrument);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        delete clientInstruments[socket.id];
        connectedUsers.delete(socket.id);
        io.emit('users_update', connectedUsers.size);
      });
    });

    // Test REST endpoint
    app.get('/', (req: Request, res: Response) => {
      res.send('Rock Band backend running!');
    });

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1); // exit if DB connection fails
  }
}

startServer();
