
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function MrRacer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 650;
  const HORIZON = CANVAS_HEIGHT * 0.38;
  const FOV = 120;
  
  const playerX = useRef(0);
  const targetX = useRef(0);
  const playerSpeed = useRef(0.1);
  const targetSpeed = useRef(0.1);
  const enemies = useRef<{ x: number, z: number, speed: number, color: string, type: string }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});

  const initGame = useCallback(() => {
    playerX.current = 0;
    targetX.current = 0;
    playerSpeed.current = 0.1;
    targetSpeed.current = 0.1;
    enemies.current = [];
    roadOffset.current = 0;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    if (enemies.current.length > 4) return;
    const lanes = [-120, 0, 120];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    const colors = ['#1e3a8a', '#991b1b', '#065f46', '#334155', '#111827'];
    enemies.current.push({
      x: laneX,
      z: 5000,
      speed: 0.04 + Math.random() * 0.03, 
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.8 ? 'truck' : 'car'
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    if (keys.current['LeftPress']) targetX.current -= 12;
    if (keys.current['RightPress']) targetX.current += 12;
    targetX.current = Math.max(-170, Math.min(170, targetX.current));
    playerX.current += (targetX.current - playerX.current) * 0.15;

    if (keys.current['Accel']) targetSpeed.current = Math.min(0.28, targetSpeed.current + 0.003);
    else if (keys.current['Brake']) targetSpeed.current = Math.max(0.05, targetSpeed.current - 0.008);
    else targetSpeed.current = Math.max(0.1, targetSpeed.current - 0.001);

    playerSpeed.current += (targetSpeed.current - playerSpeed.current) * 0.1;
    roadOffset.current = (roadOffset.current + playerSpeed.current * 120) % 200;
    setScore(s => s + Math.floor(playerSpeed.current * 25));

    if (Math.random() < 0.01) spawnEnemy();
    
    enemies.current.forEach(e => {
      const relativeSpeed = (playerSpeed.current - e.speed) * 220;
      e.z -= relativeSpeed;

      const carW = e.type === 'truck' ? 90 : 70;
      if (e.z > -20 && e.z < 80) {
        if (Math.abs(e.x - playerX.current) < carW) {
          setGameOver(true);
        }
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -1000);
  }, [gameOver, spawnEnemy]);

  const drawVehicle = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 5.2;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.01) return;

    const vW = (type === 'truck' ? 220 : 170) * scale;
    const vH = (type === 'truck' ? 240 : 160) * scale;
    const depth = (type === 'truck' ? 180 : 120) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, vW);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 5, vW * 0.8, vH * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-vW/2, -vH, vW, vH, 12 * scale);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    const sideX = (x - playerX.current) > 0 ? -vW/2 : vW/2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(sideX, -vH);
    ctx.lineTo(sideX * 0.8, -vH - depth);
    ctx.lineTo(sideX * 0.8, -depth);
    ctx.lineTo(sideX, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(-vW/2, -vH);
    ctx.lineTo(vW/2, -vH);
    ctx.lineTo(vW/2 * 0.8, -vH - depth);
    ctx.lineTo(-vW/2 * 0.8, -vH - depth);
    ctx.closePath();
    ctx.fill();

    const lightW = 35 * scale;
    const lightH = 15 * scale;
    const lightY = -vH * 0.65;
    
    ctx.shadowBlur = 30 * scale;
    ctx.shadowColor = '#ef4444';
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-vW/2 + 15 * scale, lightY, lightW, lightH);
    ctx.fillRect(vW/2 - 15 * scale - lightW, lightY, lightW, lightH);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'white';
    ctx.fillRect(-20 * scale, -vH * 0.3, 40 * scale, 15 * scale);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(0.7, '#1e293b');
    sky.addColorStop(1, '#334155');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);
    
    const fog = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 150);
    fog.addColorStop(0, '#334155');
    fog.addColorStop(1, 'transparent');
    ctx.fillStyle = fog;
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, 150);

    for (let i = 0; i < 25; i++) {
      const z = i * 200 - roadOffset.current;
      if (z < 0) continue;
      const s = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * s;
      const dw = 18 * s;
      const dl = 140 * s;
      
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      [-95, 95].forEach(lx => {
          const x = CANVAS_WIDTH/2 + (lx * s * 5.8) - (playerX.current * s * 5.2);
          ctx.fillRect(x - dw/2, y, dw, dl);
      });
    }

    const sortedEnemies = [...enemies.current].sort((a, b) => b.z - a.z);
    sortedEnemies.forEach(e => drawVehicle(ctx, e.x, e.z, e.color, false, e.type));
    
    drawVehicle(ctx, playerX.current, 55, '#7c3aed', true);

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
        if (e.key === 'ArrowLeft') keys.current['LeftPress'] = true;
        if (e.key === 'ArrowRight') keys.current['RightPress'] = true;
    };
    const handleUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') keys.current['LeftPress'] = false;
        if (e.key === 'ArrowRight') keys.current['RightPress'] = false;
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#020617] overflow-hidden touch-none select-none">
      <div className="absolute top-12 left-12 flex flex-col z-20 pointer-events-none">
        <div className="text-7xl font-headline font-bold text-white tracking-tighter italic drop-shadow-2xl">
          {Math.floor(score / 12)} <span className="text-xl text-primary font-normal">MPH</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={650} className="w-full h-auto max-h-[98vh] shadow-inner" />

      {!gameOver && (
          <div className="absolute bottom-12 inset-x-8 flex justify-between z-30">
              <div 
                  className="w-24 h-32 bg-black/50 border-2 border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer active:bg-red-900/40 transition-all active:scale-95"
                  onPointerDown={() => keys.current['Brake'] = true}
                  onPointerUp={() => keys.current['Brake'] = false}
                  onPointerLeave={() => keys.current['Brake'] = false}
              >
                  <span className="text-white/40 text-[10px] font-bold uppercase mb-2">Brake</span>
                  <div className="w-14 h-3 bg-white/20 rounded-full" />
              </div>

              <div 
                  className="w-24 h-40 bg-black/50 border-2 border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer active:bg-primary/40 transition-all active:scale-95"
                  onPointerDown={() => keys.current['Accel'] = true}
                  onPointerUp={() => keys.current['Accel'] = false}
                  onPointerLeave={() => keys.current['Accel'] = false}
              >
                  <span className="text-white/40 text-[10px] font-bold uppercase mb-2">Accel</span>
                  <div className="w-10 h-22 bg-primary/20 rounded-xl border border-primary/30" />
              </div>
          </div>
      )}

      {!gameOver && (
        <div className="absolute inset-0 z-10 flex">
          <div className="flex-1" onPointerDown={() => keys.current['LeftPress'] = true} onPointerUp={() => keys.current['LeftPress'] = false} />
          <div className="flex-1" onPointerDown={() => keys.current['RightPress'] = true} onPointerUp={() => keys.current['RightPress'] = false} />
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-xl">
          <h2 className="text-8xl font-headline font-bold text-red-600 mb-8 tracking-tighter italic">COLLISION</h2>
          <p className="text-2xl text-white mb-12 font-bold">{Math.floor(score / 12)} MILES TRAVELED</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-20 py-12 text-3xl font-bold bg-primary border-b-4 border-primary/60 hover:scale-105 transition-transform shadow-2xl">
            RETRY
          </Button>
        </div>
      )}
    </div>
  );
}
