import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { io, Socket } from 'socket.io-client';

import './App.css';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL; // read env variable

const socket: Socket = io(SOCKET_URL || 'http://localhost:3000');
const keyMap: Record<string, string> = {
  a: 'C4',
  s: 'D4',
  d: 'E4',
  f: 'F4',
  g: 'G4',
  h: 'A4',
  j: 'B4',
};

const instruments = [
  'Synth',
  'AMSynth',
  'FMSynth',
  'DuoSynth',
  'MembraneSynth',
  'MetalSynth',
  'MonoSynth',
] as const;
function App() {
  type InstrumentType = (typeof instruments)[number];

  const [instrument1, setInstrument1] = useState<InstrumentType>('Synth');
  const [instrument2, setInstrument2] = useState<InstrumentType>('Synth');
  const [users, setUsers] = useState<number>(0);
  // const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());

  // const noteTimeouts = useRef<Map<string, number>>(new Map());

  // const triggerVisual = (note: string) => {
  //   // 1️⃣ Add note safely
  //   setActiveNotes((prev) => {
  //     const next = new Set(prev);
  //     next.add(note); // always mutate the fresh Set
  //     return next;
  //   });

  //   // 2️⃣ Clear previous timeout if it exists
  //   if (noteTimeouts.current.has(note)) {
  //     clearTimeout(noteTimeouts.current.get(note));
  //   }

  //   // 3️⃣ Schedule removal
  //   const timeout = window.setTimeout(() => {
  //     setActiveNotes((prev) => {
  //       const next = new Set(prev);
  //       next.delete(note);
  //       return next;
  //     });
  //     noteTimeouts.current.delete(note);
  //   }, 150);

  //   noteTimeouts.current.set(note, timeout);
  // };

  const keysDownLocal = useRef(new Set<string>());
  const keysDownNet = useRef(new Set<string>());
  const createSynth = (instrument: InstrumentType) => {
    const SynthClass = Tone[
      instrument as keyof typeof Tone
    ] as unknown as typeof Tone.Synth;
    return new Tone.PolySynth(SynthClass).toDestination();
  };

  const synth1 = useRef(createSynth(instrument1));
  const synth2 = useRef(createSynth(instrument2));
  const broadcastSynth = useRef(createSynth('DuoSynth'));

  useEffect(() => {
    synth1.current.dispose();
    synth1.current = createSynth(instrument1);
  }, [instrument1]);

  useEffect(() => {
    synth2.current.dispose();
    synth2.current = createSynth(instrument2);
  }, [instrument2]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!keysDownLocal.current.has(e.key) && keyMap[e.key]) {
        // Start audio context on first key press

        if (Tone.getContext().state !== 'running') {
          Tone.start().then(() => {
            console.log('AudioContext started!');
          });
        }
        keysDownLocal.current.add(e.key);

        // Play all currently held keys as a chord
        const chord = Array.from(keysDownLocal.current).map((k) => keyMap[k]);
        synth1.current.triggerAttack(chord);
        // synth2.current.triggerAttack(chord);
        socket.emit('key_down', e.key); // broadcast to others
        // triggerVisual(keyMap[e.key]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownLocal.current.delete(e.key);

      const note = keyMap[e.key];
      synth1.current.triggerRelease(note);
      synth2.current.triggerRelease(note);
      if (keysDownLocal.current.size === 0) {
        synth1.current.releaseAll();
        synth2.current.releaseAll();
      }
      socket.emit('key_up', e.key); // broadcast to others
    };

    // Listen for notes from other players
    socket.on('key_down', (key) => {
      // triggerVisual(keyMap[key]);

      console.log('playing from broadcast');
      keysDownNet.current.add(key);

      const chord = Array.from(keysDownNet.current).map((k) => keyMap[k]);

      broadcastSynth.current?.triggerAttack(chord);
    });

    // // Listen for notes from other players
    socket.on('key_up', (key) => {
      console.log('pausing from broadcast');
      keysDownNet.current.delete(key);

      const note = keyMap[key];
      broadcastSynth.current.triggerRelease(note);
      if (keysDownNet.current.size === 0) {
        broadcastSynth.current.releaseAll();
      }
    });

    socket.on('users_update', (users) => {
      setUsers(users);
    });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      socket.off('key_down');
      socket.off('users_update');
      socket.off('key_up');
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Rock Band Multiplayer</h1>
      <p>Press A–J keys to play notes 🎸</p>
      <h2>Connected users: {users}</h2>
      <select
        value={instrument1}
        onChange={(e) => setInstrument1(e.target.value as any)}
      >
        <option value="AMSynth">AMSynth</option>
        <option value="DuoSynth">DuoSynth</option>
        <option value="FMSynth">FMSynth</option>
        <option value="MembraneSynth">MembraneSynth</option>
        <option value="MetalSynth">MetalSynth</option>
        <option value="MonoSynth">MonoSynth</option>
      </select>

      <select
        value={instrument2}
        onChange={(e) => setInstrument2(e.target.value as any)}
      >
        <option value="Synth">Synth</option>
        <option value="AMSynth">AMSynth</option>
        <option value="FMSynth">FMSynth</option>
        <option value="DuoSynth">DuoSynth</option>
        <option value="MembraneSynth">MembraneSynth</option>
        <option value="MetalSynth">MetalSynth</option>
        <option value="MonoSynth">MonoSynth</option>
      </select>

      {/* <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 20,
          justifyContent: 'center',
        }}
      >
        {Object.values(keyMap).map((note) => (
          <div
            key={note}
            style={{
              width: 60,
              height: 200,
              border: '1px solid black',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              background: activeNotes.has(note) ? '#4ade80' : 'white',
              transition: 'background 0.05s',
            }}
          >
            {note}
          </div>
        ))}
      </div> */}
    </div>
  );
}

export default App;
