
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
  const CANVAS_HEIGHT = 600;
  const HORIZON = CANVAS_HEIGHT * 0.45;
  const FOV = 120;
  
  const playerX = useRef(0);
  const targetX = useRef(0);
  const enemies = useRef<{ x: number, z: number, speed: number, color: string, type: string, seed: number }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameSpeed = useRef(0.06);

  const initGame = useCallback(() => {
    playerX.current = 0;
    targetX.current = 0;
    enemies.current = [];
    roadOffset.current = 0;
    gameSpeed.current = 0.06;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    const laneX = (Math.floor(Math.random() * 3) - 1) * 85;
    const colors = ['#1e40af', '#dc2626', '#059669', '#d97706', '#4b5563'];
    enemies.current.push({
      x: laneX,
      z: 1500,
      speed: 1.0 + Math.random() * 3.0,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.8 ? 'truck' : 'car',
      seed: Math.random()
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    if (keys.current['ArrowLeft'] || keys.current['a']) targetX.current -= 6;
    if (keys.current['ArrowRight'] || keys.current['d']) targetX.current += 6;

    playerX.current += (targetX.current - playerX.current) * 0.1;
    targetX.current = Math.max(-140, Math.min(140, targetX.current));
    playerX.current = Math.max(-140, Math.min(140, playerX.current));

    roadOffset.current = (roadOffset.current + gameSpeed.current * 40) % 100;
    gameSpeed.current += 0.00003;
    setScore(s => s + 1);

    if (Math.random() < 0.03) spawnEnemy();
    
    enemies.current.forEach(e => {
      e.z -= (gameSpeed.current * 120) + e.speed;
      if (e.z > -10 && e.z < 45) {
        const dist = Math.abs(e.x - playerX.current);
        const hitWidth = e.type === 'truck' ? 70 : 60;
        if (dist < hitWidth) setGameOver(true);
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -200);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 3.2;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.04) return;

    const carW = (type === 'truck' ? 120 : 100) * scale;
    const carH = (type === 'truck' ? 90 : 60) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 0.8, carH * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(0, -carH, 0, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(0.6, color);
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 8 * scale);
    ctx.fill();

    // Reflection
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(-carW/2.2, -carH * 0.9, carW * 0.9, carH * 0.1);

    // Windows
    ctx.fillStyle = 'rgba(5,5,20,0.9)';
    ctx.fillRect(-carW/2.5, -carH * 0.8, (carW/2.5)*2, carH * 0.3);

    // Lights
    if (isPlayer) {
      // Taillights
      ctx.fillStyle = '#ff0000';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowColor = '#ff0000';
      ctx.fillRect(-carW/2 + 2, -carH * 0.45, 12 * scale, 8 * scale);
      ctx.fillRect(carW/2 - 14, -carH * 0.45, 12 * scale, 8 * scale);
    } else {
      // Headlights
      ctx.fillStyle = '#fff9e6';
      ctx.shadowBlur = 12 * scale;
      ctx.shadowColor = '#fff9e6';
      ctx.fillRect(-carW/2 + 2, -carH * 0.98, 18 * scale, 15 * scale);
      ctx.fillRect(carW/2 - 20, -carH * 0.98, 18 * scale, 15 * scale);
    }

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Cinematic Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(0.8, '#1e293b');
    skyGrad.addColorStop(1, '#334155');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Horizon Glow
    const horizonGrad = ctx.createLinearGradient(0, HORIZON - 10, 0, HORIZON + 10);
    horizonGrad.addColorStop(0, 'rgba(51,65,85,0)');
    horizonGrad.addColorStop(0.5, 'rgba(196,29,250,0.2)');
    horizonGrad.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, HORIZON - 10, CANVAS_WIDTH, 20);

    // Realistic Asphalt
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Subtle Road Grain
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for(let i=0; i<100; i++) {
      ctx.fillRect(Math.random()*CANVAS_WIDTH, HORIZON + Math.random()*(CANVAS_HEIGHT-HORIZON), 1, 1);
    }

    // Lane Markers
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = -1.5; i <= 1.5; i++) {
       const laneX = i * 120;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 - (playerX.current * (FOV/(FOV+1200))), HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (laneX * 3.8) - playerX.current * 3.8, CANVAS_HEIGHT);
       ctx.stroke();
    }

    // Moving Dashboard Markers
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      const z = i * 70 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      const dashW = 180 * scale;
      const dashLen = 15 * scale;
      
      ctx.beginPath();
      // Left
      ctx.moveTo(CANVAS_WIDTH/2 - dashW - (playerX.current * scale * 3.2), y);
      ctx.lineTo(CANVAS_WIDTH/2 - (dashW - dashLen) - (playerX.current * scale * 3.2), y);
      // Right
      ctx.moveTo(CANVAS_WIDTH/2 + dashW - (playerX.current * scale * 3.2), y);
      ctx.lineTo(CANVAS_WIDTH/2 + (dashW - dashLen) - (playerX.current * scale * 3.2), y);
      ctx.stroke();
    }

    // Sort and draw entities
    const sortedEnemies = [...enemies.current].sort((a, b) => b.z - a.z);
    sortedEnemies.forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));
    
    // Player
    drawCar(ctx, playerX.current, 30, '#C41DFA', true);

  }, [score, roadOffset.current]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  const handlePointer = (clientX: number, isDown: boolean) => {
    if (gameOver) return;
    const mid = window.innerWidth / 2;
    if (isDown) {
      if (clientX < mid) keys.current['ArrowLeft'] = true;
      else keys.current['ArrowRight'] = true;
    } else {
      keys.current['ArrowLeft'] = false;
      keys.current['ArrowRight'] = false;
    }
  };

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => keys.current[e.key] = true;
    const handleUp = (e: KeyboardEvent) => keys.current[e.key] = false;
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10)); }, [gameOver, score, onGameOver]);

  return (
    <div 
        className="relative w-full h-full flex flex-col items-center justify-center bg-[#020617] overflow-hidden touch-none select-none"
        onPointerDown={(e) => handlePointer(e.clientX, true)}
        onPointerUp={() => handlePointer(0, false)}
        onPointerLeave={() => handlePointer(0, false)}
    >
      <div className="absolute top-12 left-12 flex flex-col items-start z-20 pointer-events-none">
        <span className="text-xs uppercase tracking-[0.5em] font-black text-primary/60 mb-2">High Speed HUD</span>
        <div className="text-8xl font-headline font-bold text-white tracking-tighter italic shadow-2xl">
          {Math.floor(score / 10)} <span className="text-2xl text-primary">KM</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[95vh] shadow-2xl" />

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8 text-center z-30 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-destructive mb-6 tracking-tighter italic">CRASH</h2>
          <p className="text-2xl text-white/50 mb-12 uppercase tracking-[0.4em]">Distance : {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-20 py-12 text-3xl font-bold bg-primary hover:scale-105 transition-transform shadow-2xl shadow-primary/40">
            TRY AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
