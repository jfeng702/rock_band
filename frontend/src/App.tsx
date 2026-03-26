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
  const [activeLocalNotes, setActiveLocalNotes] = useState<Set<string>>(
    new Set(),
  );
  const [activeNetNotes, setActiveNetNotes] = useState<Set<string>>(new Set());

  const addNote = (note: string, isLocal: boolean) => {
    const cb = (prev: Set<string>) => {
      const next = new Set(prev);
      next.add(note);
      return next;
    };
    if (isLocal) {
      setActiveLocalNotes(cb);
    } else {
      setActiveNetNotes(cb);
    }
  };

  const removeNote = (note: string, isLocal: boolean) => {
    const cb = (prev: Set<string>) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    };

    isLocal ? setActiveLocalNotes(cb) : setActiveNetNotes(cb);
  };

  const keysDownLocal = useRef(new Set<string>());
  const keysDownNet = useRef(new Set<string>());

  const createSynth = (instrument: InstrumentType) => {
    const SynthClass = Tone[
      instrument as keyof typeof Tone
    ] as unknown as typeof Tone.Synth;
    return new Tone.PolySynth(SynthClass).toDestination();
  };

  const synth1 = useRef<Tone.PolySynth | null>(null);
  const synth2 = useRef<Tone.PolySynth | null>(null);
  const broadcastSynth = useRef<Tone.PolySynth | null>(null);

  useEffect(() => {
    synth1.current = createSynth(instrument1);
    return () => {
      synth1.current?.dispose();
      synth1.current = null;
    };
  }, [instrument1]);

  useEffect(() => {
    synth2.current = createSynth(instrument2);
    return () => {
      synth2.current?.dispose();
      synth2.current = null;
    };
  }, [instrument2]);

  useEffect(() => {
    broadcastSynth.current = createSynth('DuoSynth');
    return () => {
      broadcastSynth.current?.dispose();
      broadcastSynth.current = null;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const note = keyMap[e.key];

      if (!keysDownLocal.current.has(e.key) && keyMap[e.key]) {
        // Start audio context on first key press

        if (Tone.getContext().state !== 'running') {
          Tone.start().then(() => {
            console.log('AudioContext started!');
          });
        }
        keysDownLocal.current.add(e.key);
        addNote(note, true);

        // Play all currently held keys as a chord
        const chord = Array.from(keysDownLocal.current).map((k) => keyMap[k]);
        synth1.current?.triggerAttack(chord);
        synth2.current?.triggerAttack(chord);
        socket.emit('key_down', e.key); // broadcast to others
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const note = keyMap[e.key];
      if (!note) return;
      removeNote(note, true);

      keysDownLocal.current.delete(e.key);

      synth1.current?.triggerRelease(note);
      synth2.current?.triggerRelease(note);
      if (keysDownLocal.current.size === 0) {
        synth1.current?.releaseAll();
        synth2.current?.releaseAll();
      }
      socket.emit('key_up', e.key); // broadcast to others
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Listen for notes from other players
    socket.on('key_down', (key) => {
      console.log('playing from broadcast');
      keysDownNet.current.add(key);
      const note = keyMap[key];
      addNote(note, false);

      const chord = Array.from(keysDownNet.current).map((k) => keyMap[k]);

      broadcastSynth.current?.triggerAttack(chord);
    });

    // // Listen for notes from other players
    socket.on('key_up', (key) => {
      console.log('pausing from broadcast');
      keysDownNet.current.delete(key);

      const note = keyMap[key];
      removeNote(note, false);
      broadcastSynth.current?.triggerRelease(note);
      if (keysDownNet.current.size === 0) {
        broadcastSynth.current?.releaseAll();
      }
    });

    socket.on('users_update', (users) => {
      setUsers(users);
    });

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

      <h3>Other Players 🎹</h3>
      <div
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
              background: activeNetNotes.has(note)
                ? 'rgb(201, 48, 27)'
                : 'white',
              transition: 'background 0.05s',
            }}
          >
            {note}
          </div>
        ))}
      </div>
      <h3>Your Keyboard 🎹</h3>

      <div
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
              background: activeLocalNotes.has(note) ? '#4ade80' : 'white',
              transition: 'background 0.05s',
            }}
          >
            {note}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
