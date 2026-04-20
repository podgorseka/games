
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Zap } from 'lucide-react';

export default function PlatformerCube({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isInvincible, setIsInvincible] = useState(false);
  const gameLoopRef = useRef<number>(0);

  const playerY = useRef(350);
  const playerVelocity = useRef(0);
  const obstacles = useRef<{ x: number, w: number, h: number, type: 'spike' | 'block' }[]>([]);
  const powerups = useRef<{ x: number, y: number, w: number, h: number, active: boolean }[]>([]);
  
  const invincibilityTimer = useRef<number | null>(null);
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
    powerups.current = [];
    setScore(0);
    setGameOver(false);
    setIsInvincible(false);
    if (invincibilityTimer.current) clearTimeout(invincibilityTimer.current);
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

    if (obstacles.current.length === 0 || obstacles.current[obstacles.current.length - 1].x < 500) {
      if (Math.random() < 0.03) {
        obstacles.current.push({ 
          x: 800, 
          w: 40, 
          h: 40 + Math.random() * 30,
          type: Math.random() > 0.5 ? 'spike' : 'block'
        });
      }
      
      if (Math.random() < 0.003) {
        powerups.current.push({
          x: 900,
          y: groundY - 150 - Math.random() * 100,
          w: 30,
          h: 30,
          active: true
        });
      }
    }

    obstacles.current = obstacles.current.filter(o => o.x > -100);
    obstacles.current.forEach(o => {
      o.x -= speed;
      if (!isInvincible &&
        o.x < 100 + 40 &&
        o.x + o.w > 100 &&
        playerY.current + 40 > groundY - o.h
      ) {
        setGameOver(true);
      }
    });

    powerups.current = powerups.current.filter(p => p.x > -100);
    powerups.current.forEach(p => {
      p.x -= speed;
      if (p.active &&
        p.x < 100 + 40 &&
        p.x + p.w > 100 &&
        playerY.current < p.y + p.h &&
        playerY.current + 40 > p.y
      ) {
        p.active = false;
        setIsInvincible(true);
        if (invincibilityTimer.current) clearTimeout(invincibilityTimer.current);
        invincibilityTimer.current = window.setTimeout(() => setIsInvincible(false), 5000);
      }
    });
  }, [gameOver, isInvincible]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 500);

    // Dark Synthwave Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 500);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(0.6, '#1e1b4b');
    skyGrad.addColorStop(1, '#312e81');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 800, 500);

    // Grid Perspective
    ctx.strokeStyle = '#c084fc44';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const y = groundY + i * 15;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }
    for (let i = 0; i < 20; i++) {
      const x = (i * 80) - ((Date.now() / 20) % 80);
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }

    // Mountains Silhouette
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(150, 250);
    ctx.lineTo(300, groundY);
    ctx.lineTo(450, 200);
    ctx.lineTo(600, groundY);
    ctx.lineTo(750, 280);
    ctx.lineTo(800, groundY);
    ctx.fill();

    // Ground Line (Neon)
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#C41DFA';
    ctx.strokeStyle = '#C41DFA';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(800, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Player
    const px = 100;
    const py = playerY.current;
    const size = 40;

    ctx.save();
    if (isInvincible) {
      const time = Date.now() / 100;
      ctx.fillStyle = `hsl(${time % 360}, 100%, 70%)`;
      ctx.shadowBlur = 20;
      ctx.shadowColor = `hsl(${time % 360}, 100%, 50%)`;
    } else {
      ctx.fillStyle = '#C41DFA';
    }
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, size, size);

    // Face
    ctx.fillStyle = 'white';
    ctx.fillRect(px + 22, py + 10, 6, 6);
    ctx.fillRect(px + 10, py + 10, 6, 6);
    ctx.fillRect(px + 12, py + 24, 16, 4);
    ctx.restore();

    // Powerups
    powerups.current.forEach(p => {
      if (p.active) {
        const time = Date.now() / 200;
        ctx.fillStyle = `hsl(${time % 360}, 80%, 60%)`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'white';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.shadowBlur = 0;
      }
    });

    // Obstacles
    obstacles.current.forEach(o => {
      ctx.fillStyle = '#FA1D64';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FA1D64';
      if (o.type === 'spike') {
        ctx.beginPath();
        ctx.moveTo(o.x, groundY);
        ctx.lineTo(o.x + o.w / 2, groundY - o.h);
        ctx.lineTo(o.x + o.w, groundY);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(o.x, groundY - o.h, o.w, o.h);
      }
      ctx.shadowBlur = 0;
    });
  }, [isInvincible]);

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
    <div className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer overflow-hidden touch-none" onMouseDown={jump} onTouchStart={jump}>
      <div className="absolute top-8 flex items-center gap-4 z-20">
        <div className="text-4xl font-headline font-bold text-primary drop-shadow-md">Score: {score}</div>
        {isInvincible && <div className="bg-primary text-white px-4 py-1 rounded-full animate-pulse flex items-center gap-2 font-bold shadow-lg"><Zap className="h-4 w-4 fill-current" /> INVINCIBLE</div>}
      </div>
      <canvas ref={canvasRef} width={800} height={500} className="w-full h-auto max-h-[75vh] border-4 border-primary rounded-3xl bg-black shadow-2xl" />
      {gameOver && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 z-30 cursor-default backdrop-blur-sm">
          <h2 className="text-6xl font-headline font-bold text-destructive mb-4 tracking-tighter">CRASHED!</h2>
          <p className="text-3xl font-headline font-bold mb-8 text-foreground">Final Score: {score}</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold shadow-2xl hover:scale-105 transition-transform"><RotateCcw className="mr-3 h-8 w-8" /> Restart</Button>
        </div>
      )}
    </div>
  );
}
