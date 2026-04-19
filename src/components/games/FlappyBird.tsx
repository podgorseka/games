
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function FlappyBird({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);
  
  const birdY = useRef(250);
  const birdVelocity = useRef(0);
  const pipes = useRef<{ x: number, top: number, passed: boolean }[]>([]);
  
  // Adjusted physics for smoother movement
  const gravity = 0.35;
  const jumpStrength = -6.5;
  const pipeSpeed = 3.5;
  const pipeWidth = 60;
  const pipeGap = 180;

  const jump = useCallback(() => {
    if (gameOver) return;
    birdVelocity.current = jumpStrength;
  }, [gameOver]);

  const initGame = useCallback(() => {
    birdY.current = 250;
    birdVelocity.current = 0;
    pipes.current = [];
    setScore(0);
    setGameOver(false);
    
    // Initial pipe
    pipes.current.push({ x: 600, top: Math.random() * 200 + 50, passed: false });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    birdVelocity.current += gravity;
    birdY.current += birdVelocity.current;

    // Boundary check
    if (birdY.current < 0 || birdY.current > 470) {
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

      // Collision (bird is approx 30x30 circle)
      const birdHitbox = { x: 115, y: birdY.current + 15, r: 15 };
      if (
        birdHitbox.x + birdHitbox.r > p.x && 
        birdHitbox.x - birdHitbox.r < p.x + pipeWidth && 
        (birdHitbox.y - birdHitbox.r < p.top || birdHitbox.y + birdHitbox.r > p.top + pipeGap)
      ) {
        setGameOver(true);
      }
    });
  }, [gameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 500);

    // Sky Background
    ctx.fillStyle = '#F0F9FF';
    ctx.fillRect(0, 0, 800, 500);

    // Clouds (simple circles)
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(100, 100, 40, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(400, 150, 50, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(700, 80, 45, 0, Math.PI*2); ctx.fill();

    // Pipes
    pipes.current.forEach(p => {
      ctx.fillStyle = '#2600CC';
      ctx.fillRect(p.x, 0, pipeWidth, p.top);
      ctx.fillRect(p.x, p.top + pipeGap, pipeWidth, 500 - (p.top + pipeGap));
      
      // Pipe caps
      ctx.fillStyle = '#1A0088';
      ctx.fillRect(p.x - 5, p.top - 20, pipeWidth + 10, 20);
      ctx.fillRect(p.x - 5, p.top + pipeGap, pipeWidth + 10, 20);
    });

    // Bird
    ctx.fillStyle = '#FAC11D';
    ctx.beginPath();
    ctx.arc(115, birdY.current + 15, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2600CC';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Bird Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(122, birdY.current + 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(124, birdY.current + 10, 2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#FA1D64';
    ctx.beginPath();
    ctx.moveTo(130, birdY.current + 15);
    ctx.lineTo(145, birdY.current + 20);
    ctx.lineTo(130, birdY.current + 25);
    ctx.fill();
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
    const handleKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') jump(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [jump]);

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer overflow-hidden touch-none"
      onMouseDown={jump}
      onTouchStart={jump}
    >
      <div className="absolute top-8 text-5xl font-headline font-bold text-primary z-20 drop-shadow-lg">
        {score}
      </div>

      <canvas 
        ref={canvasRef} 
        width={800} 
        height={500} 
        className="w-full h-auto max-h-[75vh] border-4 border-primary rounded-3xl bg-white shadow-2xl"
      />

      {!gameOver && (
        <p className="mt-4 text-primary/50 font-bold uppercase tracking-widest animate-pulse">
          {isMobile ? 'Tap to Fly' : 'Press Space to Fly'}
        </p>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 text-center z-30 cursor-default backdrop-blur-sm">
          <h2 className="text-6xl font-headline font-bold text-destructive mb-4 tracking-tighter">GAME OVER</h2>
          <p className="text-3xl font-headline font-bold mb-8">Score: {score}</p>
          <Button onClick={initGame} size="lg" className="px-12 py-8 text-2xl font-bold rounded-full shadow-xl">
            <RotateCcw className="mr-3 h-8 w-8" /> Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
