# Rock Band Multiplayer

Rock Band Multiplayer is a browser-based music jam app built with React, Tone.js, Express, and Socket.IO. Players can trigger notes with the keyboard or by clicking the on-screen piano keys, switch synth instruments, and hear other connected players in real time.

## Features

- Play notes locally with the `A` through `J` keys.
- Click the on-screen piano keys to play the same notes with the mouse.
- Switch between multiple Tone.js synth types.
- Broadcast note presses and releases to other connected clients in real time.
- See remote notes highlighted separately from your own notes.
- Track the number of connected users.
- Track player's instrument and friend's instrument

## Tech Stack

- Frontend: React, TypeScript, Vite, Tone.js, Socket.IO Client
- Backend: Node.js, TypeScript, Express, Socket.IO, MongoDB

## Project Structure

```text
rock_band/
├── frontend/   # React + Vite client
└── backend/    # Express + Socket.IO server
```

## Getting Started

### 1. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
```

The backend runs on port `3000` by default.

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

The frontend runs on port `5173` by default.

## Environment Variables

### Frontend

The frontend connects to the backend using `VITE_BACKEND_URL`.

Example:

```env
VITE_BACKEND_URL=http://localhost:3000
```

If `VITE_BACKEND_URL` is not set, the app falls back to `http://localhost:3000`.

### Backend

The backend supports:

- `PORT`: HTTP and Socket.IO server port. Defaults to `3000`.
- `FRONTEND_URL`: Allowed frontend origin for Socket.IO CORS.

Example:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## How It Works

- The frontend uses Tone.js poly synths for local playback.
- Keyboard and mouse input trigger local notes and emit socket events.
- The backend relays `note_down`, `note_up`, and `change_instrument` events to other clients.
- Connected user count is broadcast whenever clients connect or disconnect.

## Available Scripts

### Frontend

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

### Backend

```bash
npm run dev
npm run build
npm start
```

## Future Improvements

- Track instrument state per remote player.
- Add rooms so separate groups can jam independently.
- Add a better piano layout with white and black keys.
- Add recording or loop playback features.
