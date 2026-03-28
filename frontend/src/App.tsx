import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
  k: 'C5',
  l: 'D5',
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
  const notes = Object.values(keyMap);

  const [instrument1, setInstrument1] = useState<InstrumentType>('Synth');
  const [netInstrument, setNetInstrument] = useState<InstrumentType>('Synth');
  const [users, setUsers] = useState<number>(0);
  const [activeLocalNotes, setActiveLocalNotes] = useState<Set<string>>(
    new Set(),
  );
  const [activeNetNotes, setActiveNetNotes] = useState<Set<string>>(new Set());
  const instrument1Ref = useRef(instrument1);
  const notesDownLocal = useRef(new Set<string>());
  const notesDownNet = useRef(new Set<string>());
  const activePointers = useRef(new Map<number, string>());

  const addNote = useCallback((note: string, isLocal: boolean) => {
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
  }, []);

  const removeNote = useCallback((note: string, isLocal: boolean) => {
    const cb = (prev: Set<string>) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    };

    if (isLocal) {
      setActiveLocalNotes(cb);
    } else {
      setActiveNetNotes(cb);
    }
  }, []);

  const createSynth = useCallback((instrument: InstrumentType) => {
    const SynthClass = Tone[
      instrument as keyof typeof Tone
    ] as unknown as typeof Tone.Synth;
    return new Tone.PolySynth(SynthClass).toDestination();
  }, []);

  const synth1 = useRef<Tone.PolySynth | null>(null);
  const broadcastSynth = useRef<Tone.PolySynth | null>(null);

  const handleNoteDown = useCallback(
    async (note: string) => {
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
    },
    [addNote],
  );

  const handleNoteUp = useCallback(
    (note: string) => {
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
    },
    [removeNote],
  );

  const releaseAllLocalNotes = useCallback(() => {
    const activeNotes = Array.from(notesDownLocal.current);
    if (activeNotes.length === 0) return;

    activePointers.current.clear();

    activeNotes.forEach((note) => {
      removeNote(note, true);
      socket.emit('note_up', {
        note,
        instrument1: instrument1Ref.current,
      });
    });

    notesDownLocal.current.clear();
    synth1.current?.releaseAll();
  }, [removeNote]);

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
  }, [instrument1, createSynth]);

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
  }, [netInstrument, createSynth]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const note = keyMap[e.key.toLowerCase()];
      if (!note) return;
      await handleNoteDown(note);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const note = keyMap[e.key.toLowerCase()];
      if (!note) return;
      handleNoteUp(note);
    };

    const handleWindowBlur = () => {
      releaseAllLocalNotes();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [handleNoteDown, handleNoteUp, releaseAllLocalNotes]);

  useEffect(() => {
    const handleRemoteNoteDown = (data: { note: string }) => {
      notesDownNet.current.add(data.note);
      addNote(data.note, false);

      const chord = Array.from(notesDownNet.current);

      broadcastSynth.current?.triggerAttack(chord);
    };

    const handleRemoteNoteUp = (data: { note: string }) => {
      notesDownNet.current.delete(data.note);

      removeNote(data.note, false);

      broadcastSynth.current?.triggerRelease(data.note);

      if (notesDownNet.current.size === 0) {
        broadcastSynth.current?.releaseAll();
      }
    };

    const handleRemoteInstrumentChange = (instrument: InstrumentType) => {
      setNetInstrument(instrument);
    };

    const handleUsersUpdate = (nextUsers: number) => {
      setUsers(nextUsers);
    };

    socket.on('note_down', handleRemoteNoteDown);
    socket.on('note_up', handleRemoteNoteUp);
    socket.on('change_instrument', handleRemoteInstrumentChange);
    socket.on('users_update', handleUsersUpdate);

    return () => {
      socket.off('note_down', handleRemoteNoteDown);
      socket.off('note_up', handleRemoteNoteUp);
      socket.off('change_instrument', handleRemoteInstrumentChange);
      socket.off('users_update', handleUsersUpdate);
    };
  }, [addNote, removeNote]);

  useEffect(() => {
    socket.on('connect', () => {
      socket.emit('change_instrument', instrument1Ref.current);
    });
  }, []);

  const handlePointerDown = async (
    e: ReactPointerEvent<HTMLButtonElement>,
    note: string,
  ) => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    e.preventDefault();
    activePointers.current.set(e.pointerId, note);
    e.currentTarget.setPointerCapture(e.pointerId);
    await handleNoteDown(note);
  };

  const releasePointer = (
    e: ReactPointerEvent<HTMLButtonElement>,
    note: string,
  ) => {
    e.preventDefault();

    const activeNote = activePointers.current.get(e.pointerId) ?? note;
    activePointers.current.delete(e.pointerId);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    handleNoteUp(activeNote);
  };

  return (
    <div className="app-shell">
      <h1>Rock Band Multiplayer</h1>
      <p>Press A–J keys to play notes 🎸</p>
      <h2>Connected users: {users}</h2>
      <label className="instrument-label">
        <span>Select an instrument</span>
        <select
          value={instrument1}
          onChange={(e) => {
            e.target.blur();
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
      <div className="keyboard-row" role="group" aria-label="Other players">
        {notes.map((note) => (
          <div
            key={note}
            className={`note-key note-key--remote${
              activeNetNotes.has(note) ? ' note-key--active-remote' : ''
            }`}
          >
            {note}
          </div>
        ))}
      </div>
      <h3>Your Instrument {instrumentIcons[instrument1]}</h3>

      <div className="keyboard-row" role="group" aria-label="Your instrument">
        {notes.map((note) => (
          <button
            key={note}
            type="button"
            className={`note-key note-key--local${
              activeLocalNotes.has(note) ? ' note-key--active-local' : ''
            }`}
            onPointerDown={(e) => void handlePointerDown(e, note)}
            onPointerUp={(e) => releasePointer(e, note)}
            onPointerCancel={(e) => releasePointer(e, note)}
          >
            {note}
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
