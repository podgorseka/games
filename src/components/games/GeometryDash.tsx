"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function GeometryDash({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const playerY = useRef(350);
  const playerVelocity = useRef(0);
  const obstacles = useRef<{ x: number, w: number, h: number }[]>([]);
  const gravity = 0.6;
  const jumpStrength = -12;
  const speed = 6;
  const groundY = 400;

  const jump = useCallback(() => {
    if (gameOver) return;
    if (playerY.current >= groundY - 30) {
      playerVelocity.current = jumpStrength;
    }
  }, [gameOver]);

  const initGame = useCallback(() => {
    playerY.current = groundY - 30;
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

    if (playerY.current > groundY - 30) {
      playerY.current = groundY - 30;
      playerVelocity.current = 0;
    }

    if (obstacles.current.length === 0 || obstacles.current[obstacles.current.length - 1].x < 600) {
      if (Math.random() < 0.02) {
        obstacles.current.push({ x: 800, w: 30, h: 30 + Math.random() * 40 });
      }
    }

    obstacles.current = obstacles.current.filter(o => o.x > -50);
    obstacles.current.forEach(o => {
      o.x -= speed;
      // Collision
      if (
        o.x < 100 + 30 &&
        o.x + o.w > 100 &&
        playerY.current + 30 > groundY - o.h
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

    // Ground
    ctx.fillStyle = '#2600CC';
    ctx.fillRect(0, groundY, 800, 100);

    // Player
    ctx.fillStyle = '#C41DFA';
    ctx.fillRect(100, playerY.current, 30, 30);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, playerY.current, 30, 30);

    // Obstacles
    ctx.fillStyle = '#2600CC';
    obstacles.current.forEach(o => {
      ctx.fillRect(o.x, groundY - o.h, o.w, o.h);
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
      <div className="absolute top-8 text-3xl font-headline font-bold text-primary z-20">Score: {score}</div>
      <canvas ref={canvasRef} width={800} height={500} className="w-full h-auto max-h-[70vh] border-4 border-primary rounded-2xl bg-white shadow-xl" />
      {isMobile && !gameOver && <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none text-white/20 text-4xl font-bold">TAP TO JUMP</div>}
      {gameOver && (
        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center p-4 z-30 cursor-default">
          <h2 className="text-4xl font-headline font-bold text-destructive mb-2">CRASHED!</h2>
          <p className="text-xl mb-6">Score: {score}</p>
          <Button onClick={initGame} size="lg"><RotateCcw className="mr-2 h-4 w-4" /> Restart</Button>
        </div>
      )}
    </div>
  );
}
