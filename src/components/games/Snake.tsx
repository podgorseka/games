
"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

type Point = { x: number; y: number };

export default function Snake({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const GRID_SIZE = 20;
  const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const directionRef = useRef<Point>({ x: 0, y: -1 });
  const lastUpdateRef = useRef(0);
  const requestRef = useRef<number>(0);
  const touchStartRef = useRef<Point | null>(null);

  const moveSnake = useCallback(() => {
    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const dir = directionRef.current;
      const newHead = { x: head.x + dir.x, y: head.y + dir.y };

      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE || 
          prevSnake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        setGameOver(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 10);
        setFood({ x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) });
      } else {
        newSnake.pop();
      }
      return newSnake;
    });
  }, [food]);

  const animate = useCallback((time: number) => {
    if (!gameOver) {
      if (time - lastUpdateRef.current > 150) {
        moveSnake();
        lastUpdateRef.current = time;
      }
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [moveSnake, gameOver]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const updateDirection = useCallback((newDir: Point) => {
    const current = directionRef.current;
    if ((newDir.x !== 0 && newDir.x === -current.x) || (newDir.y !== 0 && newDir.y === -current.y)) return;
    directionRef.current = newDir;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') updateDirection({ x: 0, y: -1 });
      if (e.key === 'ArrowDown') updateDirection({ x: 0, y: 1 });
      if (e.key === 'ArrowLeft') updateDirection({ x: -1, y: 0 });
      if (e.key === 'ArrowRight') updateDirection({ x: 1, y: 0 });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [updateDirection]);

  // Touch controls (Swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || gameOver) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Minimum distance to trigger a move
    const threshold = 30;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      if (Math.abs(dx) > Math.abs(dy)) {
        updateDirection({ x: dx > 0 ? 1 : -1, y: 0 });
      } else {
        updateDirection({ x: 0, y: dy > 0 ? 1 : -1 });
      }
      // Reset start to allow multiple swipes without lifting finger
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  useEffect(() => { if (gameOver) onGameOver(score); }, [gameOver, score, onGameOver]);

  const reset = () => {
    setSnake(INITIAL_SNAKE);
    directionRef.current = { x: 0, y: -1 };
    setScore(0);
    setGameOver(false);
    lastUpdateRef.current = performance.now();
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center p-4 touch-none select-none">
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
          const x = i % GRID_SIZE; const y = Math.floor(i / GRID_SIZE);
          const isSnake = snake.some(s => s.x === x && s.y === y);
          const isFood = food.x === x && food.y === y;
          const isHead = snake[0].x === x && snake[0].y === y;
          return (
            <div 
              key={i} 
              className={`w-full h-full rounded-sm ${
                isHead ? 'bg-primary z-10' : 
                isSnake ? 'bg-primary/40' : 
                isFood ? 'bg-secondary animate-pulse scale-90 rounded-full' : 
                'border-[0.5px] border-primary/5'
              }`} 
            />
          );
        })}
        {gameOver && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 text-center z-20 backdrop-blur-sm">
            <h2 className="text-5xl font-headline font-bold text-destructive mb-2">GAME OVER</h2>
            <Button onClick={reset} size="lg" className="rounded-full px-12 py-8 text-xl font-bold shadow-xl">
              <RotateCcw className="mr-3 h-6 w-6" /> Rejouer
            </Button>
          </div>
        )}
      </div>
      
      {!gameOver && (
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          {isMobile ? "Glissez votre doigt pour diriger le serpent" : "Utilisez les flèches du clavier"}
        </p>
      )}
    </div>
  );
}
