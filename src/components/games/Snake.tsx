
"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

type Point = { x: number; y: number };

export default function Snake({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const GRID_SIZE = 20;
  const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const directionRef = useRef<Point>({ x: 0, y: -1 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const moveSnake = useCallback(() => {
    if (gameOver) return;

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const dir = directionRef.current;
      const newHead = { x: head.x + dir.x, y: head.y + dir.y };

      // Check walls
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        setGameOver(true);
        return prevSnake;
      }

      // Check self
      if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 10);
        setFood({
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE)
        });
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, gameOver]);

  const updateDirection = useCallback((newDir: Point) => {
    // Prevent 180 degree turns
    const current = directionRef.current;
    if (newDir.x === -current.x && newDir.x !== 0) return;
    if (newDir.y === -current.y && newDir.y !== 0) return;
    directionRef.current = newDir;
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': updateDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': updateDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': updateDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': updateDirection({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [updateDirection]);

  useEffect(() => {
    if (!gameOver) {
      gameLoopRef.current = setInterval(moveSnake, 130);
    }
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [moveSnake, gameOver]);

  useEffect(() => {
    if (gameOver) {
      onGameOver(score);
    }
  }, [gameOver, score, onGameOver]);

  const reset = () => {
    setSnake(INITIAL_SNAKE);
    directionRef.current = { x: 0, y: -1 };
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center p-4">
      <div className="text-4xl font-bold font-headline text-primary">Score: {score}</div>
      
      <div 
        className="relative bg-muted/20 border-4 border-primary rounded-2xl overflow-hidden shadow-2xl"
        style={{ 
          width: 'min(90vw, 400px)', 
          height: 'min(90vw, 400px)', 
          display: 'grid', 
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
          const x = i % GRID_SIZE;
          const y = Math.floor(i / GRID_SIZE);
          const isSnake = snake.some(s => s.x === x && s.y === y);
          const isFood = food.x === x && food.y === y;
          const isHead = snake[0].x === x && snake[0].y === y;

          return (
            <div 
              key={i} 
              className={`w-full h-full rounded-sm ${
                isHead ? 'bg-primary z-10 shadow-lg' : isSnake ? 'bg-primary/50' : isFood ? 'bg-secondary animate-pulse scale-90 rounded-full' : 'border-[0.5px] border-primary/5'
              }`}
            />
          );
        })}
        {gameOver && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 text-center z-20 backdrop-blur-sm">
            <h2 className="text-5xl font-headline font-bold text-destructive mb-2 tracking-tighter">GAME OVER</h2>
            <p className="text-2xl font-headline font-bold mb-8">Score: {score}</p>
            <Button onClick={reset} size="lg" className="rounded-full px-12 py-8 text-xl font-bold shadow-xl">
              <RotateCcw className="mr-3 h-6 w-6" /> Restart
            </Button>
          </div>
        )}
      </div>

      {isMobile && !gameOver && (
        <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] mt-4">
          <div />
          <Button variant="outline" size="icon" className="h-16 w-16 rounded-2xl shadow-md border-2" onClick={() => updateDirection({ x: 0, y: -1 })}><ArrowUp className="h-8 w-8 text-primary" /></Button>
          <div />
          <Button variant="outline" size="icon" className="h-16 w-16 rounded-2xl shadow-md border-2" onClick={() => updateDirection({ x: -1, y: 0 })}><ArrowLeft className="h-8 w-8 text-primary" /></Button>
          <Button variant="outline" size="icon" className="h-16 w-16 rounded-2xl shadow-md border-2" onClick={() => updateDirection({ x: 0, y: 1 })}><ArrowDown className="h-8 w-8 text-primary" /></Button>
          <Button variant="outline" size="icon" className="h-16 w-16 rounded-2xl shadow-md border-2" onClick={() => updateDirection({ x: 1, y: 0 })}><ArrowRight className="h-8 w-8 text-primary" /></Button>
        </div>
      )}
    </div>
  );
}
