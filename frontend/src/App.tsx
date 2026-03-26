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

  const notesDownLocal = useRef(new Set<string>());
  const notesDownNet = useRef(new Set<string>());

  const createSynth = (instrument: InstrumentType) => {
    const SynthClass = Tone[
      instrument as keyof typeof Tone
    ] as unknown as typeof Tone.Synth;
    return new Tone.PolySynth(SynthClass).toDestination();
  };

  const synth1 = useRef<Tone.PolySynth | null>(null);
  const netSynths = useRef<Record<string, Tone.PolySynth>>({});
  const getNetSynth = (instrument: InstrumentType) => {
    if (!netSynths.current[instrument]) {
      netSynths.current[instrument] = createSynth(instrument);
    }
    return netSynths.current[instrument];
  };

  useEffect(() => {
    synth1.current = createSynth(instrument1);
    return () => {
      synth1.current?.releaseAll();
      synth1.current?.dispose();
      synth1.current = null;
    };
  }, [instrument1]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // e.preventDefault();
      const note = keyMap[e.key];
      console.log(note, 'note');
      console.log(notesDownLocal, 'notes down local');

      if (note && !notesDownLocal.current.has(note)) {
        // Start audio context on first key press

        if (Tone.getContext().state !== 'running') {
          await Tone.start();
          console.log('AudioContext started!');
        }
        console.log('adding');

        notesDownLocal.current.add(note);
        addNote(note, true);

        // Play all currently held keys as a chord
        const chord = Array.from(notesDownLocal.current);
        synth1.current?.triggerAttack(chord);
        socket.emit('note_down', { note, instrument1 }); // broadcast to others
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const note = keyMap[e.key];
      if (!note) return;
      removeNote(note, true);

      notesDownLocal.current.delete(note);

      synth1.current?.triggerRelease(note);
      if (notesDownLocal.current.size === 0) {
        synth1.current?.releaseAll();
      }
      socket.emit('note_up', { note, instrument1 }); // broadcast to others
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Listen for notes from other players
    socket.on('note_down', (data) => {
      console.log('playing from broadcast');
      notesDownNet.current.add(data.note);
      addNote(data.note, false);

      const chord = Array.from(notesDownNet.current);

      const netSynth = getNetSynth(data.instrument1);

      netSynth.triggerAttack(chord);
      console.log('broadcast synth playing?');
    });

    // // Listen for notes from other players
    socket.on('note_up', (data) => {
      console.log('pausing from broadcast');
      notesDownNet.current.delete(data.note);

      removeNote(data.note, false);
      const netSynth = getNetSynth(data.instrument1);
      netSynth.triggerRelease(data.note);

      if (notesDownNet.current.size === 0) {
        netSynth.releaseAll();
      }
    });

    socket.on('users_update', (users) => {
      setUsers(users);
    });

    return () => {
      socket.off('note_down');
      socket.off('users_update');
      socket.off('note_up');
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Rock Band Multiplayer</h1>
      <p>Press A–J keys to play notes 🎸</p>
      <h2>Connected users: {users}</h2>
      <label className="instrument-label">
        <span>Select an instrument</span>
        <select
          value={instrument1}
          onChange={(e) => setInstrument1(e.target.value as InstrumentType)}
          className="instrument-select"
        >
          <option value="AMSynth">AMSynth</option>
          <option value="DuoSynth">DuoSynth</option>
          <option value="FMSynth">FMSynth</option>
          <option value="MembraneSynth">MembraneSynth</option>
          <option value="MetalSynth">MetalSynth</option>
          <option value="MonoSynth">MonoSynth</option>
        </select>
      </label>
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
