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
  const [direction, setDirection] = useState<Point>({ x: 0, y: -1 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const moveSnake = useCallback(() => {
    if (gameOver || paused) return;

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = { x: head.x + direction.x, y: head.y + direction.y };

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
  }, [direction, food, gameOver, paused]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (direction.y !== 1) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y !== -1) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x !== 1) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x !== -1) setDirection({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [direction]);

  useEffect(() => {
    timerRef.current = setInterval(moveSnake, 150);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [moveSnake]);

  useEffect(() => {
    if (gameOver) {
      onGameOver(score);
    }
  }, [gameOver, score, onGameOver]);

  const reset = () => {
    setSnake(INITIAL_SNAKE);
    setDirection({ x: 0, y: -1 });
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center">
      <div className="text-2xl font-bold font-headline text-primary">Score: {score}</div>
      
      <div 
        className="relative bg-muted/20 border-4 border-primary rounded-xl overflow-hidden"
        style={{ width: 'min(80vw, 400px)', height: 'min(80vw, 400px)', display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
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
              className={`w-full h-full rounded-sm transition-colors duration-200 ${
                isHead ? 'bg-primary' : isSnake ? 'bg-primary/60' : isFood ? 'bg-secondary animate-pulse scale-90 rounded-full' : ''
              }`}
            />
          );
        })}
        {gameOver && (
          <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center p-4 text-center z-10">
            <h2 className="text-3xl font-headline font-bold text-destructive mb-2">GAME OVER</h2>
            <p className="mb-4">Final Score: {score}</p>
            <Button onClick={reset} size="lg"><RotateCcw className="mr-2 h-4 w-4" /> Try Again</Button>
          </div>
        )}
      </div>

      {isMobile && !gameOver && (
        <div className="grid grid-cols-3 gap-4 w-48 mt-4">
          <div />
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={() => direction.y !== 1 && setDirection({ x: 0, y: -1 })}><ArrowUp /></Button>
          <div />
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={() => direction.x !== 1 && setDirection({ x: -1, y: 0 })}><ArrowLeft /></Button>
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={() => direction.y !== -1 && setDirection({ x: 0, y: 1 })}><ArrowDown /></Button>
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={() => direction.x !== -1 && setDirection({ x: 1, y: 0 })}><ArrowRight /></Button>
        </div>
      )}
    </div>
  );
}
