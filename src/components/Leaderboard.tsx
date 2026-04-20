
"use client"

import React from 'react';
import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Trophy, Medal, User, Gamepad2 } from 'lucide-react';
import { getScores, type ScoreEntry } from '@/lib/storage';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const GAME_IDS = ['apex-racer', 'block-blast', 'platformer-cube', 'snake', 'tetris', 'flappy-bird', 'pong'];
const GAME_NAMES: Record<string, string> = {
  'apex-racer': 'Apex Racer',
  'block-blast': 'Block Blast',
  'platformer-cube': 'Platformer Cube',
  'snake': 'Snake',
  'tetris': 'Tetris',
  'flappy-bird': 'Flappy Bird',
  'pong': 'Pong'
};

export default function Leaderboard() {
  const [scoresByGame, setScoresByGame] = React.useState<Record<string, ScoreEntry[]>>({});

  React.useEffect(() => {
    const allScores = getScores();
    const grouped: Record<string, ScoreEntry[]> = {};
    
    GAME_IDS.forEach(id => {
      grouped[id] = allScores
        .filter(s => s.gameId === id)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    });
    
    setScoresByGame(grouped);
  }, []);

  const hasAnyScores = Object.values(scoresByGame).some(s => s.length > 0);
  if (!hasAnyScores) return null;

  return (
    <div className="w-full max-w-6xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-12 justify-center">
        <Trophy className="h-10 w-10 text-yellow-500" />
        <h2 className="text-4xl font-headline font-bold">Top 3 Hall of Fame</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {GAME_IDS.map((gameId) => {
          const gameScores = scoresByGame[gameId] || [];
          if (gameScores.length === 0) return null;

          return (
            <Card key={gameId} className="border-2 hover:border-primary/50 transition-all bg-white overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-headline">
                  <Gamepad2 className="h-5 w-5 text-primary" />
                  {GAME_NAMES[gameId]}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {gameScores.map((entry, index) => (
                      <TableRow key={entry.id} className="hover:bg-primary/5 border-none">
                        <TableCell className="w-12 text-center font-bold">
                          {index === 0 ? <Medal className="h-5 w-5 mx-auto text-yellow-500" /> : 
                           index === 1 ? <Medal className="h-5 w-5 mx-auto text-slate-400" /> :
                           <Medal className="h-5 w-5 mx-auto text-orange-500" />}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium truncate max-w-[100px]">{entry.playerName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary pr-4">
                          {entry.score.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
