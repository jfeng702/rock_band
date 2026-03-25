import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';

import './App.css';

function App() {
  const instruments = [
    'Synth',
    'AMSynth',
    'FMSynth',
    'DuoSynth',
    'MembraneSynth',
    'MetalSynth',
    'MonoSynth',
    'MonoSynth',
    'MonoSynth',
    'MonoSynth',
  ] as const;
  type InstrumentType = (typeof instruments)[number];

  const [instrument1, setInstrument1] = useState<InstrumentType>('Synth');

  const [instrument2, setInstrument2] = useState<InstrumentType>('Synth');

  const keyMap: Record<string, string> = {
    a: 'C4',
    s: 'D4',
    d: 'E4',
    f: 'F4',
    g: 'G4',
    h: 'A4',
    j: 'B4',
  };

  const keysDown = useRef(new Set<string>());
  const createSynth = (instrument: InstrumentType) => {
    const SynthClass = Tone[
      instrument as keyof typeof Tone
    ] as unknown as typeof Tone.Synth;
    return new Tone.PolySynth(SynthClass).toDestination();
  };

  const synth1 = useRef(createSynth(instrument1));
  const synth2 = useRef(createSynth(instrument2));

  useEffect(() => {
    synth1.current.dispose();
    synth1.current = createSynth(instrument1);
  }, [instrument1]);

  useEffect(() => {
    synth2.current.dispose();
    synth2.current = createSynth(instrument2);
  }, [instrument2]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!keysDown.current.has(e.key) && keyMap[e.key]) {
        // Start audio context on first key press

        if (Tone.getContext().state !== 'running') {
          Tone.start().then(() => {
            console.log('AudioContext started!');
          });
        }
        keysDown.current.add(e.key);

        // Play all currently held keys as a chord
        const chord = Array.from(keysDown.current).map((k) => keyMap[k]);
        synth1.current.triggerAttack(chord);
        synth2.current.triggerAttack(chord);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.key);

      const note = keyMap[e.key];
      synth1.current.triggerRelease(note);
      synth2.current.triggerRelease(note);
      if (keysDown.current.size === 0) {
        synth1.current.releaseAll();
        synth2.current.releaseAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div>
      <h1>Rock Band Multiplayer</h1>
      <p>Press A–J keys to play notes 🎸</p>
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
    </div>
  );
}

export default App;
