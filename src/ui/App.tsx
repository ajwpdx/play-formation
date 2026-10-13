import { useState } from 'react';
import { createGame, type GameState } from '../engine';
import { GameBoard } from './GameBoard';
import { SetupScreen } from './SetupScreen';

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [showTally, setShowTally] = useState(true);
  return game ? (
    <GameBoard key={game.config.seed} initial={game} showTally={showTally} onExit={() => setGame(null)} />
  ) : (
    <SetupScreen onStart={(numPlayers, numSuits, tally) => {
      setShowTally(tally);
      setGame(createGame({ numPlayers, numSuits }));
    }} />
  );
}
