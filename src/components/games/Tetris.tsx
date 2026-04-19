"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ArrowDown, RotateCw, ArrowDownToLine, RotateCcw } from 'lucide-react';

const COLS = 10;
const ROWS = 20;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]],
};

const COLORS = ['#C41DFA', '#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D', '#1D5DFA', '#A41DFA'];

export default function Tetris({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const [grid, setGrid] = useState(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
  const [currentPiece, setCurrentPiece] = useState<{ shape: number[][], pos: { x: number, y: number }, color: string } | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const dropCounter = useRef(0);
  const dropInterval = useRef(800);
  const lastTime = useRef(0);

  const spawnPiece = useCallback(() => {
    const keys = Object.keys(SHAPES) as (keyof typeof SHAPES)[];
    const shape = SHAPES[keys[Math.floor(Math.random() * keys.length)]];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const piece = { shape, pos: { x: 3, y: 0 }, color };
    
    // Check game over
    if (collide(grid, piece)) {
      setGameOver(true);
      return null;
    }
    return piece;
  }, [grid]);

  const collide = (grid: any[][], piece: any) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== 0) {
          const gridY = piece.pos.y + y;
          const gridX = piece.pos.x + x;
          if (gridY >= ROWS || gridX < 0 || gridX >= COLS || (grid[gridY] && grid[gridY][gridX] !== 0)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const merge = (grid: any[][], piece: any) => {
    const newGrid = grid.map(row => [...row]);
    piece.shape.forEach((row: any[], y: number) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          newGrid[piece.pos.y + y][piece.pos.x + x] = piece.color;
        }
      });
    });
    return newGrid;
  };

  const clearLines = (grid: any[][]) => {
    let linesCleared = 0;
    const newGrid = grid.filter(row => {
      const isFull = row.every(cell => cell !== 0);
      if (isFull) linesCleared++;
      return !isFull;
    });
    while (newGrid.length < ROWS) {
      newGrid.unshift(Array(COLS).fill(0));
    }
    if (linesCleared > 0) {
      setScore(s => s + [0, 100, 300, 500, 800][linesCleared]);
      dropInterval.current = Math.max(100, 800 - (score / 100) * 10);
    }
    return newGrid;
  };

  const drop = useCallback(() => {
    if (gameOver || !currentPiece) return;
    const nextPos = { ...currentPiece, pos: { ...currentPiece.pos, y: currentPiece.pos.y + 1 } };
    if (collide(grid, nextPos)) {
      const mergedGrid = merge(grid, currentPiece);
      const clearedGrid = clearLines(mergedGrid);
      setGrid(clearedGrid);
      const nextPiece = spawnPiece();
      setCurrentPiece(nextPiece);
    } else {
      setCurrentPiece(nextPos);
    }
    dropCounter.current = 0;
  }, [currentPiece, grid, gameOver, spawnPiece, score]);

  const move = (dir: number) => {
    if (gameOver || !currentPiece) return;
    const nextPos = { ...currentPiece, pos: { ...currentPiece.pos, x: currentPiece.pos.x + dir } };
    if (!collide(grid, nextPos)) setCurrentPiece(nextPos);
  };

  const rotate = () => {
    if (gameOver || !currentPiece) return;
    const rotated = currentPiece.shape[0].map((_, i) => currentPiece.shape.map(row => row[i]).reverse());
    const nextPiece = { ...currentPiece, shape: rotated };
    if (!collide(grid, nextPiece)) setCurrentPiece(nextPiece);
  };

  const hardDrop = () => {
    if (gameOver || !currentPiece) return;
    let nextPos = { ...currentPiece };
    while (!collide(grid, { ...nextPos, pos: { ...nextPos.pos, y: nextPos.pos.y + 1 } })) {
      nextPos.pos.y += 1;
    }
    const mergedGrid = merge(grid, nextPos);
    setGrid(clearLines(mergedGrid));
    setCurrentPiece(spawnPiece());
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowDown') drop();
      if (e.key === 'ArrowUp') rotate();
      if (e.key === ' ') hardDrop();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPiece, grid, gameOver]);

  useEffect(() => {
    setCurrentPiece(spawnPiece());
  }, []);

  useEffect(() => {
    const loop = (time = 0) => {
      const deltaTime = time - lastTime.current;
      lastTime.current = time;
      dropCounter.current += deltaTime;
      if (dropCounter.current > dropInterval.current) {
        drop();
      }
      requestAnimationFrame(loop);
    };
    const animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [drop]);

  useEffect(() => {
    if (gameOver) onGameOver(score);
  }, [gameOver, score, onGameOver]);

  const reset = () => {
    setGrid(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
    setScore(0);
    setGameOver(false);
    setCurrentPiece(spawnPiece());
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center">
      <div className="text-2xl font-bold font-headline text-primary">Score: {score}</div>
      
      <div 
        className="relative bg-muted/20 border-4 border-primary rounded-xl overflow-hidden shadow-xl"
        style={{ width: 'min(70vw, 300px)', height: 'min(140vw, 600px)', display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {grid.map((row, y) => row.map((cell, x) => {
          let color = cell;
          if (currentPiece) {
            const py = y - currentPiece.pos.y;
            const px = x - currentPiece.pos.x;
            if (py >= 0 && py < currentPiece.shape.length && px >= 0 && px < currentPiece.shape[py].length) {
              if (currentPiece.shape[py][px] !== 0) color = currentPiece.color;
            }
          }
          return (
            <div 
              key={`${y}-${x}`} 
              className={`w-full h-full border-[0.5px] border-white/10 rounded-[2px]`}
              style={{ backgroundColor: color !== 0 ? color as string : 'transparent' }}
            />
          );
        }))}
        
        {gameOver && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 text-center z-10">
            <h2 className="text-3xl font-headline font-bold text-destructive mb-2">GAME OVER</h2>
            <p className="mb-4">Final Score: {score}</p>
            <Button onClick={reset} size="lg"><RotateCcw className="mr-2 h-4 w-4" /> Restart</Button>
          </div>
        )}
      </div>

      {isMobile && !gameOver && (
        <div className="grid grid-cols-5 gap-2 w-full max-w-sm px-4 mt-2">
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => move(-1)}><ArrowLeft /></Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => move(1)}><ArrowRight /></Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={rotate}><RotateCw /></Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={drop}><ArrowDown /></Button>
          <Button variant="secondary" size="icon" className="h-12 w-12" onClick={hardDrop}><ArrowDownToLine /></Button>
        </div>
      )}
    </div>
  );
}
