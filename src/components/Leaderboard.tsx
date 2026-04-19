"use client"

import React from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Trophy, Medal, User } from 'lucide-react';
import { getScores, type ScoreEntry } from '@/lib/storage';

export default function Leaderboard() {
  const [scores, setScores] = React.useState<ScoreEntry[]>([]);

  React.useEffect(() => {
    const allScores = getScores();
    const sorted = allScores.sort((a, b) => b.score - a.score).slice(0, 10);
    setScores(sorted);
  }, []);

  if (scores.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-8 justify-center">
        <Trophy className="h-8 w-8 text-yellow-500" />
        <h2 className="text-3xl font-headline font-bold">Global Leaderboard</h2>
      </div>

      <div className="bg-white rounded-3xl border shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-20 text-center">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Game</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((entry, index) => (
              <TableRow key={entry.id} className="hover:bg-primary/5 transition-colors">
                <TableCell className="text-center font-bold">
                  {index === 0 ? <Medal className="h-5 w-5 mx-auto text-yellow-500" /> : 
                   index === 1 ? <Medal className="h-5 w-5 mx-auto text-slate-400" /> :
                   index === 2 ? <Medal className="h-5 w-5 mx-auto text-orange-500" /> :
                   index + 1}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {entry.playerName}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.gameName}</TableCell>
                <TableCell className="text-right font-bold text-primary">{entry.score.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
