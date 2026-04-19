"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function FlappyBird({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);
  
  // Game state refs for the loop
  const birdY = useRef(200);
  const birdVelocity = useRef(0);
  const pipes = useRef<{ x: number, top: number, passed: boolean }[]>([]);
  const gravity = 0.5;
  const jumpStrength = -8;
  const pipeSpeed = 3;
  const pipeWidth = 60;
  const pipeGap = 160;

  const jump = useCallback(() => {
    if (gameOver) return;
    birdVelocity.current = jumpStrength;
  }, [gameOver]);

  const initGame = useCallback(() => {
    birdY.current = 200;
    birdVelocity.current = 0;
    pipes.current = [];
    setScore(0);
    setGameOver(false);
    
    // Initial pipe
    pipes.current.push({ x: 400, top: Math.random() * 200 + 50, passed: false });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    birdVelocity.current += gravity;
    birdY.current += birdVelocity.current;

    // Boundary check
    if (birdY.current < 0 || birdY.current > 480) {
      setGameOver(true);
      return;
    }

    // Pipes update
    if (pipes.current.length === 0 || pipes.current[pipes.current.length - 1].x < 500) {
      pipes.current.push({
        x: 800,
        top: Math.random() * 200 + 50,
        passed: false
      });
    }

    pipes.current = pipes.current.filter(p => p.x > -pipeWidth);
    pipes.current.forEach(p => {
      p.x -= pipeSpeed;

      // Score
      if (!p.passed && p.x < 100) {
        p.passed = true;
        setScore(s => s + 1);
      }

      // Collision
      if (
        100 + 30 > p.x && 
        100 < p.x + pipeWidth && 
        (birdY.current < p.top || birdY.current + 30 > p.top + pipeGap)
      ) {
        setGameOver(true);
      }
    });
  }, [gameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 500);

    // Background
    ctx.fillStyle = '#F7F0F9';
    ctx.fillRect(0, 0, 800, 500);

    // Pipes
    pipes.current.forEach(p => {
      ctx.fillStyle = '#2600CC';
      // Top pipe
      ctx.fillRect(p.x, 0, pipeWidth, p.top);
      // Bottom pipe
      ctx.fillRect(p.x, p.top + pipeGap, pipeWidth, 500 - (p.top + pipeGap));
    });

    // Bird
    ctx.fillStyle = '#C41DFA';
    ctx.beginPath();
    ctx.arc(115, birdY.current + 15, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      update();
      draw(ctx);
      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    if (gameOver) onGameOver(score);
  }, [gameOver, score, onGameOver]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.code === 'Space') jump(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [jump]);

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer overflow-hidden touch-none"
      onMouseDown={jump}
      onTouchStart={jump}
    >
      <div className="absolute top-8 text-4xl font-headline font-bold text-primary z-20">
        {score}
      </div>

      <canvas 
        ref={canvasRef} 
        width={800} 
        height={500} 
        className="w-full h-auto max-h-[70vh] border-4 border-primary rounded-2xl bg-white shadow-2xl"
      />

      {!isMobile && (
        <p className="mt-4 text-muted-foreground">Press SPACE or Click to jump</p>
      )}
      
      {isMobile && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
           {!gameOver && <p className="text-white/30 text-2xl font-bold uppercase tracking-widest">Tap Anywhere</p>}
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center p-4 text-center z-30 cursor-default">
          <h2 className="text-5xl font-headline font-bold text-destructive mb-4">CRASHED!</h2>
          <p className="text-2xl mb-8">Score: {score}</p>
          <Button onClick={initGame} size="lg" className="px-12 py-6 text-xl rounded-full shadow-lg">
            <RotateCcw className="mr-3 h-6 w-6" /> Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
