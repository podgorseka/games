
"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ArrowDown, RotateCw, RotateCcw } from 'lucide-react';

const COLS = 10;
const ROWS = 20;
const SHAPES = { 
  I: [[1, 1, 1, 1]], 
  J: [[1, 0, 0], [1, 1, 1]], 
  L: [[0, 0, 1], [1, 1, 1]], 
  O: [[1, 1], [1, 1]], 
  S: [[0, 1, 1], [1, 1, 0]], 
  T: [[0, 1, 0], [1, 1, 1]], 
  Z: [[1, 1, 0], [0, 1, 1]] 
};
const COLORS = ['#C41DFA', '#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D'];

export default function Tetris({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const [grid, setGrid] = useState(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
  const [currentPiece, setCurrentPiece] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const requestRef = useRef<number>(0);

  const collide = (grid: any[][], piece: any) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== 0) {
          if (piece.pos.y + y >= ROWS || 
              piece.pos.x + x < 0 || 
              piece.pos.x + x >= COLS || 
              (grid[piece.pos.y + y] && grid[piece.pos.y + y][piece.pos.x + x] !== 0)) return true;
        }
      }
    }
    return false;
  };

  const spawnPiece = useCallback(() => {
    const keys = Object.keys(SHAPES) as (keyof typeof SHAPES)[];
    const shape = SHAPES[keys[Math.floor(Math.random() * keys.length)]];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return { shape, pos: { x: 3, y: 0 }, color };
  }, []);

  const drop = useCallback(() => {
    setCurrentPiece((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, pos: { ...prev.pos, y: prev.pos.y + 1 } };
      if (collide(grid, next)) {
        const newGrid = grid.map(row => [...row]);
        prev.shape.forEach((row: any[], y: number) => row.forEach((val: number, x: number) => { 
          if (val) newGrid[prev.pos.y + y][prev.pos.x + x] = prev.color; 
        }));
        
        let lines = 0;
        const clearedGrid = newGrid.filter(row => { 
          const full = row.every(c => c !== 0); 
          if (full) lines++; 
          return !full; 
        });
        
        while (clearedGrid.length < ROWS) clearedGrid.unshift(Array(COLS).fill(0));
        setGrid(clearedGrid);
        setScore(s => s + [0, 100, 300, 500, 800][lines]);
        
        const nextP = spawnPiece();
        if (collide(clearedGrid, nextP)) {
          setGameOver(true);
          return prev;
        }
        return nextP;
      }
      return next;
    });
    dropCounterRef.current = 0;
  }, [grid, spawnPiece]);

  const animate = useCallback((time: number) => {
    if (!gameOver) {
      const dt = time - lastTimeRef.current; 
      lastTimeRef.current = time;
      dropCounterRef.current += dt;
      if (dropCounterRef.current > 800) drop();
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [drop, gameOver]);

  useEffect(() => {
    if (!currentPiece && !gameOver) setCurrentPiece(spawnPiece());
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate, currentPiece, spawnPiece, gameOver]);

  const move = (dir: number) => setCurrentPiece((p: any) => { 
    if (!p || gameOver) return p; 
    const n = { ...p, pos: { ...p.pos, x: p.pos.x + dir } }; 
    return collide(grid, n) ? p : n; 
  });
  
  const rotate = () => setCurrentPiece((p: any) => { 
    if (!p || gameOver) return p; 
    const r = p.shape[0].map((_: any, i: number) => p.shape.map((row: any) => row[i]).reverse()); 
    const n = { ...p, shape: r }; 
    return collide(grid, n) ? p : n; 
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move(-1); 
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowDown') drop(); 
      if (e.key === 'ArrowUp') rotate();
    };
    window.addEventListener('keydown', handleKey); 
    return () => window.removeEventListener('keydown', handleKey);
  }, [drop]);

  useEffect(() => { if (gameOver) onGameOver(score); }, [gameOver, score, onGameOver]);

  const reset = () => {
    setGrid(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
    setScore(0);
    setGameOver(false);
    setCurrentPiece(spawnPiece());
    lastTimeRef.current = performance.now();
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center p-4">
      <div className="text-4xl font-bold font-headline text-primary">Score: {score}</div>
      <div className="relative bg-muted/20 border-4 border-primary rounded-2xl overflow-hidden shadow-2xl p-1" style={{ width: 'min(70vw, 300px)', height: 'min(140vw, 600px)', display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {grid.map((row, y) => row.map((cell, x) => {
          let color = cell; 
          if (currentPiece) { 
            const py = y - currentPiece.pos.y; 
            const px = x - currentPiece.pos.x; 
            if (py >= 0 && py < currentPiece.shape.length && px >= 0 && px < currentPiece.shape[0].length && currentPiece.shape[py][px]) {
              color = currentPiece.color; 
            }
          }
          return (
            <div 
              key={`${y}-${x}`} 
              className="w-full h-full border-[0.5px] border-white/5 rounded-[2px] transition-colors duration-100" 
              style={{ backgroundColor: color !== 0 ? color as string : 'transparent' }} 
            />
          );
        }))}
        {gameOver && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 text-center z-20 backdrop-blur-sm">
            <h2 className="text-5xl font-headline font-bold text-destructive mb-4">GAME OVER</h2>
            <Button onClick={reset} size="lg" className="rounded-full px-8 py-6 font-bold shadow-xl">
              <RotateCcw className="mr-2 h-6 w-6" /> Recommencer
            </Button>
          </div>
        )}
      </div>
      {isMobile && !gameOver && (
        <div className="grid grid-cols-4 gap-2 w-full max-w-sm mt-4">
          <Button variant="outline" className="h-16 rounded-xl" onTouchStart={() => move(-1)}><ArrowLeft /></Button>
          <Button variant="outline" className="h-16 rounded-xl" onTouchStart={() => move(1)}><ArrowRight /></Button>
          <Button variant="outline" className="h-16 rounded-xl" onTouchStart={rotate}><RotateCw /></Button>
          <Button variant="outline" className="h-16 rounded-xl" onTouchStart={drop}><ArrowDown /></Button>
        </div>
      )}
    </div>
  );
}
