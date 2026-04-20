
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
  const CANVAS_HEIGHT = 600;
  const HORIZON = CANVAS_HEIGHT * 0.45;
  const FOV = 100;
  
  const playerX = useRef(0);
  const targetX = useRef(0);
  const enemies = useRef<{ x: number, z: number, speed: number, color: string, type: string, seed: number }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameSpeed = useRef(0.08);

  const initGame = useCallback(() => {
    playerX.current = 0;
    targetX.current = 0;
    enemies.current = [];
    roadOffset.current = 0;
    gameSpeed.current = 0.08;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    const laneX = (Math.floor(Math.random() * 3) - 1) * 90;
    const colors = ['#1e40af', '#dc2626', '#059669', '#d97706', '#4b5563'];
    enemies.current.push({
      x: laneX,
      z: 2000,
      speed: 1.5 + Math.random() * 4.0,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.8 ? 'truck' : 'car',
      seed: Math.random()
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    if (keys.current['ArrowLeft'] || keys.current['a']) targetX.current -= 8;
    if (keys.current['ArrowRight'] || keys.current['d']) targetX.current += 8;

    playerX.current += (targetX.current - playerX.current) * 0.15;
    targetX.current = Math.max(-150, Math.min(150, targetX.current));
    playerX.current = Math.max(-150, Math.min(150, playerX.current));

    roadOffset.current = (roadOffset.current + gameSpeed.current * 50) % 100;
    gameSpeed.current += 0.00005;
    setScore(s => s + 1);

    if (Math.random() < 0.04) spawnEnemy();
    
    enemies.current.forEach(e => {
      e.z -= (gameSpeed.current * 150) + e.speed;
      if (e.z > -10 && e.z < 50) {
        const dist = Math.abs(e.x - playerX.current);
        const hitWidth = e.type === 'truck' ? 80 : 70;
        if (dist < hitWidth) setGameOver(true);
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -200);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 3.5;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.02) return;

    const carW = (type === 'truck' ? 140 : 110) * scale;
    const carH = (type === 'truck' ? 100 : 70) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // 3D Shadow with soft edges
    const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, carW);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 0.9, carH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body with 3D layers
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 10 * scale);
    ctx.fill();

    // Highlights for metallic look
    const highlight = ctx.createLinearGradient(-carW/2, -carH, carW/2, -carH);
    highlight.addColorStop(0, 'rgba(255,255,255,0)');
    highlight.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(-carW/2, -carH, carW, carH * 0.4);

    // Windows with sky reflection
    ctx.fillStyle = 'rgba(10, 20, 40, 0.95)';
    ctx.beginPath();
    ctx.roundRect(-carW/2.5, -carH * 0.85, (carW/2.5)*2, carH * 0.4, 4 * scale);
    ctx.fill();

    // Lights and Halos
    if (isPlayer) {
      // Taillights
      ctx.fillStyle = '#ff1111';
      ctx.shadowBlur = 20 * scale;
      ctx.shadowColor = '#ff0000';
      ctx.fillRect(-carW/2 + 5, -carH * 0.5, 15 * scale, 10 * scale);
      ctx.fillRect(carW/2 - 20, -carH * 0.5, 15 * scale, 10 * scale);
    } else {
      // Headlights with glow
      ctx.fillStyle = '#fffdf0';
      ctx.shadowBlur = 25 * scale;
      ctx.shadowColor = '#fffdf0';
      ctx.beginPath();
      ctx.arc(-carW/2 + 10, -carH * 0.9, 10 * scale, 0, Math.PI*2);
      ctx.arc(carW/2 - 10, -carH * 0.9, 10 * scale, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Cinematic Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(0.8, '#0f172a');
    skyGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Realistic Asphalt
    const roadGrad = ctx.createLinearGradient(0, HORIZON, 0, CANVAS_HEIGHT);
    roadGrad.addColorStop(0, '#0f172a');
    roadGrad.addColorStop(1, '#020617');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Lane Markers with motion blur simulation
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    for (let i = -1.5; i <= 1.5; i++) {
       const laneX = i * 130;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (laneX * 4) - playerX.current * 4, CANVAS_HEIGHT);
       ctx.stroke();
    }

    // Moving Road Dashes
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 25; i++) {
      const z = i * 80 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      const dashW = 10 * scale;
      const dashLen = 40 * scale;
      
      const xL = CANVAS_WIDTH/2 - (65 * scale * 4) - (playerX.current * scale * 3.5);
      const xR = CANVAS_WIDTH/2 + (65 * scale * 4) - (playerX.current * scale * 3.5);
      
      ctx.fillRect(xL - dashW/2, y, dashW, dashLen);
      ctx.fillRect(xR - dashW/2, y, dashW, dashLen);
    }

    // Draw Entities
    const sortedEnemies = [...enemies.current].sort((a, b) => b.z - a.z);
    sortedEnemies.forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));
    
    // Player
    drawCar(ctx, playerX.current, 40, '#C41DFA', true);

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
        <div className="text-8xl font-headline font-bold text-white tracking-tighter italic drop-shadow-2xl">
          {Math.floor(score / 10)} <span className="text-2xl text-primary">KM</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[98vh] shadow-2xl" />

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-30 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-destructive mb-8 tracking-tighter italic">RECKLESS</h2>
          <p className="text-2xl text-white/50 mb-16 uppercase tracking-[0.6em]">Distance : {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-3xl px-24 py-14 text-4xl font-bold bg-primary hover:scale-110 transition-transform shadow-2xl shadow-primary/50">
            REVIVE
          </Button>
        </div>
      )}
    </div>
  );
}
