import { useState } from 'react';
import { MAX_PLAYERS, MAX_SUITS, MIN_PLAYERS, MIN_SUITS } from '../engine';
import { SuitIcon } from './suits';

export function SetupScreen({ onStart }: { onStart: (players: number, suits: number, showTally: boolean) => void }) {
  const [players, setPlayers] = useState(2);
  const [suits, setSuits] = useState(12);
  const [tally, setTally] = useState(true);
  const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  return (
    <div className="setup">
      <h1>FORMATION</h1>
      <p className="tag">Line up three rows or three columns of matching suits.</p>

      <label>Players</label>
      <div className="choices">
        {range(MIN_PLAYERS, MAX_PLAYERS).map((n) => (
          <button key={n} className={n === players ? 'on' : ''} onClick={() => setPlayers(n)}>{n}</button>
        ))}
      </div>

      <label>Suits ({suits * 5} cards)</label>
      <div className="choices wrap">
        {range(MIN_SUITS, MAX_SUITS).map((n) => (
          <button key={n} className={n === suits ? 'on' : ''} onClick={() => setSuits(n)}>{n}</button>
        ))}
      </div>
      <div className="suit-preview">
        {Array.from({ length: suits }, (_, i) => <SuitIcon key={i} suit={i} size={30} />)}
      </div>

      <label className="switch">
        <input type="checkbox" checked={tally} onChange={(e) => setTally(e.target.checked)} />
        <span className="track" />
        Show suit tally (cards left in Draw / in Trash)
      </label>

      <button className="primary" onClick={() => onStart(players, suits, tally)}>Start game</button>
    </div>
  );
}
