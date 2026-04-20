
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
  const FOV = 100;
  
  const playerX = useRef(0);
  const targetX = useRef(0);
  const enemies = useRef<{ x: number, z: number, speed: number, color: string, type: string }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameSpeed = useRef(0.1);

  const initGame = useCallback(() => {
    playerX.current = 0;
    targetX.current = 0;
    enemies.current = [];
    roadOffset.current = 0;
    gameSpeed.current = 0.1;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    const laneX = (Math.floor(Math.random() * 3) - 1) * 75;
    const colors = ['#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D', '#555'];
    enemies.current.push({
      x: laneX,
      z: 700,
      speed: 1.5 + Math.random() * 3.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.85 ? 'truck' : 'car'
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    // Movement logic
    if (keys.current['ArrowLeft'] || keys.current['a']) targetX.current -= 8;
    if (keys.current['ArrowRight'] || keys.current['d']) targetX.current += 8;

    // Smooth lerp for fluid steering
    playerX.current += (targetX.current - playerX.current) * 0.2;
    targetX.current = Math.max(-130, Math.min(130, targetX.current));
    playerX.current = Math.max(-130, Math.min(130, playerX.current));

    roadOffset.current = (roadOffset.current + gameSpeed.current * 30) % 100;
    gameSpeed.current += 0.00005;
    setScore(s => s + 1);

    if (Math.random() < 0.04) spawnEnemy();
    
    enemies.current.forEach(e => {
      e.z -= (gameSpeed.current * 110) + e.speed;
      if (e.z > -10 && e.z < 25) {
        const dist = Math.abs(e.x - playerX.current);
        const hitWidth = e.type === 'truck' ? 55 : 45;
        if (dist < hitWidth) setGameOver(true);
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -50);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON) return;

    const carW = (type === 'truck' ? 85 : 70) * scale;
    const carH = (type === 'truck' ? 65 : 45) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Ambient Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 0.8, carH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body Gradient for realism
    const grad = ctx.createLinearGradient(0, -carH, 0, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 10 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Reflection
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(-carW/2 + 5, -carH + 5, carW - 10, carH * 0.2);

    // Windows
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.fillRect(-carW/2.5, -carH * 0.8, (carW/2.5)*2, carH * 0.35);

    // Dynamic Lights
    if (isPlayer) {
      ctx.fillStyle = 'red';
      ctx.shadowBlur = 25 * scale;
      ctx.shadowColor = 'red';
      ctx.fillRect(-carW/2 + 2, -carH * 0.3, 10 * scale, 6 * scale);
      ctx.fillRect(carW/2 - 12, -carH * 0.3, 10 * scale, 6 * scale);
    } else {
      ctx.fillStyle = 'rgba(255,255,150,0.9)';
      ctx.shadowBlur = 20 * scale;
      ctx.shadowColor = 'yellow';
      ctx.fillRect(-carW/2 + 2, -carH * 0.9, 12 * scale, 12 * scale);
      ctx.fillRect(carW/2 - 14, -carH * 0.9, 12 * scale, 12 * scale);
    }

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Sky - Deep Neon Night
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(0.5, '#0f172a');
    skyGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Cyberpunk Horizon Glow
    ctx.fillStyle = 'rgba(196, 29, 250, 0.05)';
    ctx.fillRect(0, HORIZON - 5, CANVAS_WIDTH, 5);

    // Road - Asphalt
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Road Texture / Speed Lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
        const y = HORIZON + (i * 12);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
    }

    // Lane Markings - Neon Blue
    ctx.strokeStyle = 'rgba(30, 144, 255, 0.4)';
    ctx.setLineDash([30, 30]);
    for (let i = -1; i <= 1; i += 2) {
       const xOffset = i * 75;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 - (playerX.current * (FOV/(FOV+700))), HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (xOffset * 15) - playerX.current, CANVAS_HEIGHT);
       ctx.stroke();
    }
    ctx.setLineDash([]);

    // Moving Central Dashes
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 30; i++) {
      const z = i * 40 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      if (y > CANVAS_HEIGHT) continue;
      
      const dashW = 110 * scale;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2 - dashW - (playerX.current * scale), y);
      ctx.lineTo(CANVAS_WIDTH/2 - (dashW - 15 * scale) - (playerX.current * scale), y);
      ctx.moveTo(CANVAS_WIDTH/2 + dashW - (playerX.current * scale), y);
      ctx.lineTo(CANVAS_WIDTH/2 + (dashW - 15 * scale) - (playerX.current * scale), y);
      ctx.stroke();
    }

    // Enemies
    enemies.current.sort((a, b) => b.z - a.z).forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));

    // Player Bolide
    drawCar(ctx, playerX.current, 15, '#C41DFA', true);

    // Speed Blur Effect
    ctx.fillStyle = 'rgba(196, 29, 250, 0.1)';
    ctx.fillRect(0, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 20);
  }, [score]);

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
      <div className="absolute top-8 left-8 flex flex-col items-start gap-1 z-20 pointer-events-none">
        <span className="text-xs uppercase tracking-[0.3em] font-bold text-primary/50">High Speed Drive</span>
        <div className="text-5xl font-headline font-bold text-white tracking-tighter italic">
          {Math.floor(score / 10)} <span className="text-xl text-primary font-normal">KM</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[90vh] shadow-[0_0_100px_rgba(196,29,250,0.1)]" />
      
      {!gameOver && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-4 opacity-5">
              <div className="text-4xl font-black rotate-[-90deg]">STEER LEFT</div>
              <div className="text-4xl font-black rotate-[90deg]">STEER RIGHT</div>
          </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8 text-center z-30 backdrop-blur-md">
          <div className="bg-destructive/10 p-4 rounded-full border border-destructive/20 mb-6">
             <RotateCcw className="h-12 w-12 text-destructive animate-spin-slow" />
          </div>
          <h2 className="text-8xl font-headline font-bold text-destructive mb-2 tracking-tighter italic scale-110">WASTED</h2>
          <p className="text-2xl text-white/60 mb-12 uppercase tracking-[0.5em] font-light">Distance : {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-16 py-10 text-3xl font-bold bg-primary hover:bg-primary/80 shadow-2xl shadow-primary/40 transition-all hover:scale-105">
            RETRY
          </Button>
        </div>
      )}
    </div>
  );
}
