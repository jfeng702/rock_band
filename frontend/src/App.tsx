import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { io, Socket } from 'socket.io-client';

import './App.css';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'; // read env variable

const socket: Socket = io(SOCKET_URL);
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

const instrumentIcons: Record<string, string> = {
  Synth: '🎹',
  AMSynth: '⚡',
  FMSynth: '🎛️',
  DuoSynth: '🎶',
  MembraneSynth: '🥁',
  MetalSynth: '🤘',
  MonoSynth: '🔊',
};

function App() {
  type InstrumentType = (typeof instruments)[number];

  const [instrument1, setInstrument1] = useState<InstrumentType>('Synth');
  const [netInstrument, setNetInstrument] = useState<InstrumentType>('Synth');
  const [users, setUsers] = useState<number>(0);
  const [activeLocalNotes, setActiveLocalNotes] = useState<Set<string>>(
    new Set(),
  );
  const [activeNetNotes, setActiveNetNotes] = useState<Set<string>>(new Set());
  const instrument1Ref = useRef(instrument1);

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
  const broadcastSynth = useRef<Tone.PolySynth | null>(null);

  useEffect(() => {
    const next = createSynth(instrument1);
    const prev = synth1.current;
    synth1.current = next;

    prev?.releaseAll();
    prev?.dispose();

    return () => {
      if (synth1.current === next) {
        synth1.current = null;
      }
      next.releaseAll();
      next.dispose();
    };
  }, [instrument1]);

  useEffect(() => {
    const next = createSynth(netInstrument);
    const prev = broadcastSynth.current;
    broadcastSynth.current = next;

    prev?.releaseAll();
    prev?.dispose();

    return () => {
      if (broadcastSynth.current === next) {
        broadcastSynth.current = null;
      }
      next.releaseAll();
      next.dispose();
    };
  }, [netInstrument]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const note = keyMap[e.key];
      if (note && !notesDownLocal.current.has(note)) {
        // Start audio context on first key press

        if (Tone.getContext().state !== 'running') {
          await Tone.start();
          console.log('AudioContext started!');
        }
        notesDownLocal.current.add(note);
        addNote(note, true);

        // Play all currently held keys as a chord
        const chord = Array.from(notesDownLocal.current);
        synth1.current?.triggerAttack(chord);
        socket.emit('note_down', { note, instrument1: instrument1Ref.current }); // broadcast to others
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
      socket.emit('note_up', { note, instrument1: instrument1Ref.current }); // broadcast to others
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    // Listen for notes from other players
    socket.on('note_down', (data) => {
      notesDownNet.current.add(data.note);
      addNote(data.note, false);

      const chord = Array.from(notesDownNet.current);

      broadcastSynth.current?.triggerAttack(chord);
    });

    // // Listen for notes from other players
    socket.on('note_up', (data) => {
      notesDownNet.current.delete(data.note);

      removeNote(data.note, false);

      broadcastSynth.current?.triggerRelease(data.note);

      if (notesDownNet.current.size === 0) {
        broadcastSynth.current?.releaseAll();
      }
    });

    socket.on('change_instrument', (instrument) => {
      setNetInstrument(instrument);
    });

    socket.on('users_update', (users) => {
      setUsers(users);
    });

    return () => {
      socket.off('note_down');
      socket.off('note_up');
      socket.off('change_instrument');
      socket.off('users_update');
    };
  }, []);

  const handleNoteDown = async (note: string) => {
    if (notesDownLocal.current.has(note)) return;

    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    notesDownLocal.current.add(note);
    addNote(note, true);

    const chord = Array.from(notesDownLocal.current);
    synth1.current?.triggerAttack(chord);

    socket.emit('note_down', {
      note,
      instrument1: instrument1Ref.current,
    });
  };

  const handleNoteUp = (note: string) => {
    if (!notesDownLocal.current.has(note)) return;

    removeNote(note, true);
    notesDownLocal.current.delete(note);

    synth1.current?.triggerRelease(note);
    if (notesDownLocal.current.size === 0) {
      synth1.current?.releaseAll();
    }

    socket.emit('note_up', {
      note,
      instrument1: instrument1Ref.current,
    });
  };
  return (
    <div style={{ padding: 20 }}>
      <h1>Rock Band Multiplayer</h1>
      <p>Press A–J keys to play notes 🎸</p>
      <h2>Connected users: {users}</h2>
      <label className="instrument-label">
        <span>Select an instrument</span>
        <select
          value={instrument1}
          onChange={(e) => {
            const newInstrument = e.target.value as InstrumentType;

            instrument1Ref.current = newInstrument;
            setInstrument1(newInstrument);
            socket.emit('change_instrument', newInstrument);
          }}
          className="instrument-select"
        >
          {instruments.map((instrument) => (
            <option key={instrument} value={instrument}>
              {instrument} {instrumentIcons[instrument]}
            </option>
          ))}
        </select>
      </label>
      <h3>Other Players {instrumentIcons[netInstrument]}</h3>
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
      <h3>Your Instrument {instrumentIcons[instrument1]}</h3>

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
            onMouseDown={() => void handleNoteDown(note)}
            onMouseUp={() => handleNoteUp(note)}
            onMouseLeave={() => handleNoteUp(note)}
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
