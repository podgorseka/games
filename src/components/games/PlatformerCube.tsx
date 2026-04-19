
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function PlatformerCube({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const playerY = useRef(350);
  const playerVelocity = useRef(0);
  const obstacles = useRef<{ x: number, w: number, h: number, type: 'spike' | 'block' }[]>([]);
  const gravity = 0.7;
  const jumpStrength = -14;
  const speed = 7;
  const groundY = 400;

  const jump = useCallback(() => {
    if (gameOver) return;
    if (playerY.current >= groundY - 40) {
      playerVelocity.current = jumpStrength;
    }
  }, [gameOver]);

  const initGame = useCallback(() => {
    playerY.current = groundY - 40;
    playerVelocity.current = 0;
    obstacles.current = [];
    setScore(0);
    setGameOver(false);
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    setScore(s => s + 1);

    playerVelocity.current += gravity;
    playerY.current += playerVelocity.current;

    if (playerY.current > groundY - 40) {
      playerY.current = groundY - 40;
      playerVelocity.current = 0;
    }

    // Obstacle generation
    if (obstacles.current.length === 0 || obstacles.current[obstacles.current.length - 1].x < 600) {
      if (Math.random() < 0.03) {
        obstacles.current.push({ 
          x: 800, 
          w: 40, 
          h: 40 + Math.random() * 30,
          type: Math.random() > 0.5 ? 'spike' : 'block'
        });
      }
    }

    obstacles.current = obstacles.current.filter(o => o.x > -100);
    obstacles.current.forEach(o => {
      o.x -= speed;
      
      // Collision detection (square player 40x40 at x=100)
      if (
        o.x < 100 + 40 &&
        o.x + o.w > 100 &&
        playerY.current + 40 > groundY - o.h
      ) {
        setGameOver(true);
      }
    });
  }, [gameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 500);

    // Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 500);
    gradient.addColorStop(0, '#FDFCFE');
    gradient.addColorStop(1, '#F0E6F5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 500);

    // Ground
    ctx.fillStyle = '#2600CC';
    ctx.fillRect(0, groundY, 800, 100);
    ctx.fillStyle = '#1A0088';
    ctx.fillRect(0, groundY, 800, 4);

    // Player (Cube with face)
    const px = 100;
    const py = playerY.current;
    const size = 40;

    ctx.fillStyle = '#C41DFA';
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, size, size);

    // Face
    ctx.fillStyle = 'white';
    // Eyes
    ctx.fillRect(px + 22, py + 10, 6, 6);
    ctx.fillRect(px + 10, py + 10, 6, 6);
    // Mouth
    ctx.fillRect(px + 12, py + 24, 16, 4);

    // Obstacles
    obstacles.current.forEach(o => {
      ctx.fillStyle = '#FA1D64';
      if (o.type === 'spike') {
        ctx.beginPath();
        ctx.moveTo(o.x, groundY);
        ctx.lineTo(o.x + o.w / 2, groundY - o.h);
        ctx.lineTo(o.x + o.w, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillRect(o.x, groundY - o.h, o.w, o.h);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x, groundY - o.h, o.w, o.h);
      }
    });
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
      <div className="absolute top-8 text-4xl font-headline font-bold text-primary z-20">Score: {score}</div>
      <canvas ref={canvasRef} width={800} height={500} className="w-full h-auto max-h-[75vh] border-4 border-primary rounded-3xl bg-white shadow-2xl" />
      {isMobile && !gameOver && <div className="absolute bottom-12 z-10 text-primary/40 text-xl font-bold uppercase tracking-widest animate-bounce">Tap to Jump</div>}
      {gameOver && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 z-30 cursor-default backdrop-blur-sm">
          <h2 className="text-6xl font-headline font-bold text-destructive mb-4 tracking-tighter">CRASHED!</h2>
          <p className="text-3xl font-headline font-bold mb-8">Final Score: {score}</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold">
            <RotateCcw className="mr-3 h-8 w-8" /> Restart
          </Button>
        </div>
      )}
    </div>
  );
}
