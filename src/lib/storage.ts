export type ScoreEntry = {
  id: string;
  playerName: string;
  gameId: string;
  gameName: string;
  score: number;
  timestamp: number;
};

const STORAGE_KEY = 'game-zone-scores';
const PLAYER_NAME_KEY = 'game-zone-player-name';

export function saveScore(playerName: string, gameId: string, gameName: string, score: number) {
  const scores = getScores();
  const newEntry: ScoreEntry = {
    id: Math.random().toString(36).substring(2, 9),
    playerName,
    gameId,
    gameName,
    score,
    timestamp: Date.now(),
  };
  scores.push(newEntry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  return newEntry;
}

export function getScores(): ScoreEntry[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function savePlayerName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

export function getPlayerName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(PLAYER_NAME_KEY) || '';
}
