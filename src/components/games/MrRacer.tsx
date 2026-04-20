
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Zap } from 'lucide-react';

export default function MrRacer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 650;
  const HORIZON = CANVAS_HEIGHT * 0.4;
  const FOV = 110;
  
  const playerX = useRef(0);
  const targetX = useRef(0);
  const playerSpeed = useRef(0.12);
  const targetSpeed = useRef(0.12);
  const enemies = useRef<{ x: number, z: number, speed: number, color: string, type: string }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});

  const initGame = useCallback(() => {
    playerX.current = 0;
    targetX.current = 0;
    playerSpeed.current = 0.12;
    targetSpeed.current = 0.12;
    enemies.current = [];
    roadOffset.current = 0;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    if (enemies.current.length > 5) return;

    const lanes = [-110, 0, 110];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    const colors = ['#1e40af', '#dc2626', '#059669', '#d97706', '#ffffff'];
    enemies.current.push({
      x: laneX,
      z: 4000,
      speed: 0.05 + Math.random() * 0.03, 
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.8 ? 'truck' : 'car'
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    // Movement logic
    if (keys.current['LeftPress']) targetX.current -= 14;
    if (keys.current['RightPress']) targetX.current += 14;

    // Pedals logic
    if (keys.current['Accel']) targetSpeed.current = Math.min(0.3, targetSpeed.current + 0.004);
    else if (keys.current['Brake']) targetSpeed.current = Math.max(0.06, targetSpeed.current - 0.007);
    else targetSpeed.current = Math.max(0.12, targetSpeed.current - 0.001);

    playerSpeed.current += (targetSpeed.current - playerSpeed.current) * 0.15;
    playerX.current += (targetX.current - playerX.current) * 0.22;
    
    targetX.current = Math.max(-165, Math.min(165, targetX.current));
    playerX.current = Math.max(-165, Math.min(165, playerX.current));

    roadOffset.current = (roadOffset.current + playerSpeed.current * 100) % 200;
    setScore(s => s + Math.floor(playerSpeed.current * 20));

    if (Math.random() < 0.015) spawnEnemy();
    
    enemies.current.forEach(e => {
      const relativeSpeed = (playerSpeed.current - e.speed) * 200;
      e.z -= relativeSpeed;

      // Real volume collision
      const carW = e.type === 'truck' ? 80 : 60;
      if (e.z > -10 && e.z < 60) {
        const dist = Math.abs(e.x - playerX.current);
        if (dist < carW) {
          setGameOver(true);
        }
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -1500);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 5.0;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.01) return;

    const carW = (type === 'truck' ? 200 : 160) * scale;
    const carH = (type === 'truck' ? 200 : 150) * scale; // Massive height
    const depth = (type === 'truck' ? 150 : 100) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Ambient Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 5, carW * 0.7, carH * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (Volume)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 15 * scale);
    ctx.fill();

    // Roof & Perspectives
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(-carW/2, -carH);
    ctx.lineTo(carW/2, -carH);
    ctx.lineTo(carW/2.4, -carH - depth);
    ctx.lineTo(-carW/2.4, -carH - depth);
    ctx.closePath();
    ctx.fill();

    // Rear Lights (Neon)
    ctx.shadowBlur = 25 * scale;
    ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-carW/2 + 15 * scale, -carH * 0.7, 35 * scale, 18 * scale);
    ctx.fillRect(carW/2 - 50 * scale, -carH * 0.7, 35 * scale, 18 * scale);
    ctx.shadowBlur = 0;

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Road Base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Dynamic Road Lines (Neon Glow)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 20; i++) {
      const z = i * 200 - roadOffset.current;
      if (z < 0) continue;
      const s = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * s;
      const dw = 15 * s;
      const dl = 120 * s;
      
      [-85, 85].forEach(lx => {
          const x = CANVAS_WIDTH/2 + (lx * s * 5.5) - (playerX.current * s * 5.0);
          ctx.fillRect(x - dw/2, y, dw, dl);
      });
    }

    // Sort by depth
    const all = [...enemies.current].sort((a, b) => b.z - a.z);
    all.forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));
    
    // Player
    drawCar(ctx, playerX.current, 50, '#C41DFA', true);

  }, [score, roadOffset.current, HORIZON]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') keys.current['Accel'] = true;
        if (e.key === 'ArrowDown') keys.current['Brake'] = true;
        if (e.key === 'ArrowLeft') keys.current['LeftPress'] = true;
        if (e.key === 'ArrowRight') keys.current['RightPress'] = true;
    };
    const handleUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') keys.current['Accel'] = false;
        if (e.key === 'ArrowDown') keys.current['Brake'] = false;
        if (e.key === 'ArrowLeft') keys.current['LeftPress'] = false;
        if (e.key === 'ArrowRight') keys.current['RightPress'] = false;
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#020617] overflow-hidden touch-none select-none">
      {/* Steering Controls (Invisible overlay) */}
      <div className="absolute inset-0 z-10 flex">
          <div 
            className="flex-1" 
            onPointerDown={() => keys.current['LeftPress'] = true} 
            onPointerUp={() => keys.current['LeftPress'] = false} 
            onPointerLeave={() => keys.current['LeftPress'] = false}
          />
          <div 
            className="flex-1" 
            onPointerDown={() => keys.current['RightPress'] = true} 
            onPointerUp={() => keys.current['RightPress'] = false} 
            onPointerLeave={() => keys.current['RightPress'] = false}
          />
      </div>

      {/* Top UI */}
      <div className="absolute top-12 left-12 flex flex-col items-start z-20 pointer-events-none">
        <div className="text-8xl font-headline font-bold text-white tracking-tighter italic drop-shadow-2xl">
          {Math.floor(score / 10)} <span className="text-2xl text-primary">KM</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={650} className="w-full h-auto max-h-[95vh]" />

      {/* Pedal Controls */}
      {!gameOver && (
          <div className="absolute bottom-12 inset-x-10 flex justify-between z-30 pointer-events-none">
              <div 
                  className="w-28 h-36 bg-black/40 border-2 border-white/20 rounded-3xl flex flex-col items-center justify-center pointer-events-auto active:bg-red-500/30 transition-all active:scale-95"
                  onPointerDown={() => keys.current['Brake'] = true}
                  onPointerUp={() => keys.current['Brake'] = false}
              >
                  <span className="text-white/50 text-xs font-bold uppercase mb-2">Brake</span>
                  <div className="w-16 h-3 bg-white/20 rounded-full" />
              </div>

              <div 
                  className="w-28 h-44 bg-black/40 border-2 border-white/20 rounded-3xl flex flex-col items-center justify-center pointer-events-auto active:bg-primary/30 transition-all active:scale-95"
                  onPointerDown={() => keys.current['Accel'] = true}
                  onPointerUp={() => keys.current['Accel'] = false}
              >
                  <span className="text-white/50 text-xs font-bold uppercase mb-2">Accel</span>
                  <div className="w-10 h-24 bg-primary/30 rounded-2xl border border-primary/50" />
              </div>
          </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-destructive mb-12 tracking-tighter italic">CRASH</h2>
          <p className="text-3xl text-white mb-16 font-bold">{Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-3xl px-24 py-16 text-4xl font-bold bg-primary hover:scale-110 shadow-2xl border-b-8 border-primary/50 transition-transform">
            RESTART
          </Button>
        </div>
      )}
    </div>
  );
}
