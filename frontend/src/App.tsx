import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';

import './App.css';

function App() {
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
  const synth = useRef(new Tone.PolySynth(Tone.Synth).toDestination());
  const amSynth = useRef(new Tone.PolySynth(Tone.AMSynth).toDestination());

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
        synth.current.triggerAttack(chord);
        amSynth.current.triggerAttack(chord);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.key);

      const note = keyMap[e.key];
      synth.current.triggerRelease(note);
      amSynth.current.triggerRelease(note);
      if (keysDown.current.size === 0) {
        synth.current.releaseAll();
        amSynth.current.releaseAll();
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
    </div>
  );
}

export default App;
