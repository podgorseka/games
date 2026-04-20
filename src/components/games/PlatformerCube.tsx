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

    // Generation logic
    if (obstacles.current.length === 0 || obstacles.current[obstacles.current.length - 1].x < 500) {
      if (Math.random() < 0.03) {
        obstacles.current.push({ 
          x: 800, 
          w: 40, 
          h: 40 + Math.random() * 30,
          type: Math.random() > 0.5 ? 'spike' : 'block'
        });
      }
      
      // Powerup arc-en-ciel - rare (0.3%)
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

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, 500);
    gradient.addColorStop(0, '#FDFCFE');
    gradient.addColorStop(1, '#F0E6F5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 500);

    // Ground
    ctx.fillStyle = '#2600CC';
    ctx.fillRect(0, groundY, 800, 100);

    // Player (avec visage)
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
    ctx.fillRect(px + 22, py + 10, 6, 6); // Oeil droit
    ctx.fillRect(px + 10, py + 10, 6, 6); // Oeil gauche
    ctx.fillRect(px + 12, py + 24, 16, 4); // Bouche
    ctx.restore();

    // Powerups (Rainbow Cubes)
    powerups.current.forEach(p => {
      if (p.active) {
        const time = Date.now() / 200;
        ctx.fillStyle = `hsl(${time % 360}, 80%, 60%)`;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      }
    });

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
        ctx.stroke();
      } else {
        ctx.fillRect(o.x, groundY - o.h, o.w, o.h);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(o.x, groundY - o.h, o.w, o.h);
      }
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
        <div className="text-4xl font-headline font-bold text-primary">Score: {score}</div>
        {isInvincible && <div className="bg-primary text-white px-4 py-1 rounded-full animate-pulse flex items-center gap-2 font-bold"><Zap className="h-4 w-4 fill-current" /> INVINCIBLE</div>}
      </div>
      <canvas ref={canvasRef} width={800} height={500} className="w-full h-auto max-h-[75vh] border-4 border-primary rounded-3xl bg-white shadow-2xl" />
      {gameOver && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 z-30 cursor-default backdrop-blur-sm">
          <h2 className="text-6xl font-headline font-bold text-destructive mb-4 tracking-tighter">CRASHED!</h2>
          <p className="text-3xl font-headline font-bold mb-8">Final Score: {score}</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold"><RotateCcw className="mr-3 h-8 w-8" /> Restart</Button>
        </div>
      )}
    </div>
  );
}
