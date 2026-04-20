
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowLeft, ArrowRight } from 'lucide-react';

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
  const enemies = useRef<{ x: number, z: number, speed: number, color: string, type: string }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameSpeed = useRef(0.08);

  const initGame = useCallback(() => {
    playerX.current = 0;
    enemies.current = [];
    roadOffset.current = 0;
    gameSpeed.current = 0.08;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    const laneX = (Math.floor(Math.random() * 3) - 1) * 70;
    const colors = ['#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D', '#333'];
    enemies.current.push({
      x: laneX,
      z: 600,
      speed: 1.0 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.8 ? 'truck' : 'car'
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    if (keys.current['ArrowLeft'] || keys.current['a']) playerX.current -= 5;
    if (keys.current['ArrowRight'] || keys.current['d']) playerX.current += 5;

    playerX.current = Math.max(-120, Math.min(120, playerX.current));
    roadOffset.current = (roadOffset.current + gameSpeed.current * 25) % 100;
    gameSpeed.current += 0.00004;
    setScore(s => s + 1);

    if (Math.random() < 0.03) spawnEnemy();
    
    enemies.current.forEach(e => {
      e.z -= (gameSpeed.current * 100) + e.speed;
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

    const carW = (type === 'truck' ? 80 : 65) * scale;
    const carH = (type === 'truck' ? 60 : 40) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 0.7, carH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 8 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();

    // Windows
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-carW/2.5, -carH * 0.85, (carW/2.5)*2, carH * 0.4);

    // Details (Spoilers, etc)
    if (!isPlayer && type === 'car') {
       ctx.fillStyle = 'rgba(0,0,0,0.2)';
       ctx.fillRect(-carW/2, -carH * 0.1, carW, 5 * scale);
    }

    // Lights
    if (isPlayer) {
      ctx.fillStyle = 'red';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowColor = 'red';
      ctx.fillRect(-carW/2 + 2, -carH * 0.3, 8 * scale, 4 * scale);
      ctx.fillRect(carW/2 - 10, -carH * 0.3, 8 * scale, 4 * scale);
    } else {
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 10 * scale;
      ctx.shadowColor = 'white';
      ctx.fillRect(-carW/2 + 2, -carH * 0.9, 8 * scale, 10 * scale);
      ctx.fillRect(carW/2 - 10, -carH * 0.9, 8 * scale, 10 * scale);
    }

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Realistic Sky (Sunset-ish)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(0.7, '#1e293b');
    skyGrad.addColorStop(1, '#334155');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Road
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Lane Markings
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.setLineDash([20, 20]);
    for (let i = -1; i <= 1; i += 2) {
       const xOffset = i * 70;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 - (playerX.current * (FOV/(FOV+600))), HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (xOffset * 10) - playerX.current, CANVAS_HEIGHT);
       ctx.stroke();
    }
    ctx.setLineDash([]);

    // Moving road dashes
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const z = i * 30 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      if (y > CANVAS_HEIGHT) continue;
      
      const dashW = 100 * scale;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2 - dashW - (playerX.current * scale), y);
      ctx.lineTo(CANVAS_WIDTH/2 - (dashW - 10 * scale) - (playerX.current * scale), y);
      ctx.moveTo(CANVAS_WIDTH/2 + dashW - (playerX.current * scale), y);
      ctx.lineTo(CANVAS_WIDTH/2 + (dashW - 10 * scale) - (playerX.current * scale), y);
      ctx.stroke();
    }

    // Enemies
    enemies.current.sort((a, b) => b.z - a.z).forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));

    // Player
    drawCar(ctx, playerX.current, 20, '#C41DFA', true);

    // UI
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Space Grotesk';
    ctx.fillText(`${Math.floor(score / 10)} KM`, 20, 40);
  }, [score]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => keys.current[e.key] = true;
    const handleUp = (e: KeyboardEvent) => keys.current[e.key] = false;
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10)); }, [gameOver, score, onGameOver]);

  const handleMobilePress = (dir: 'left' | 'right', active: boolean) => {
    if (dir === 'left') keys.current['a'] = active;
    if (dir === 'right') keys.current['d'] = active;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden touch-none">
      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[85vh] shadow-2xl" />
      
      {isMobile && !gameOver && (
        <>
          <div className="absolute left-4 bottom-12 z-20">
            <Button 
              className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl border-4 border-white/20 active:scale-90 transition-transform flex items-center justify-center"
              onPointerDown={() => handleMobilePress('left', true)}
              onPointerUp={() => handleMobilePress('left', false)}
              onPointerLeave={() => handleMobilePress('left', false)}
            >
              <ArrowLeft className="h-12 w-12" />
            </Button>
          </div>
          <div className="absolute right-4 bottom-12 z-20">
            <Button 
              className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl border-4 border-white/20 active:scale-90 transition-transform flex items-center justify-center"
              onPointerDown={() => handleMobilePress('right', true)}
              onPointerUp={() => handleMobilePress('right', false)}
              onPointerLeave={() => handleMobilePress('right', false)}
            >
              <ArrowRight className="h-12 w-12" />
            </Button>
          </div>
        </>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 text-center z-30">
          <h2 className="text-7xl font-headline font-bold text-destructive mb-4 tracking-tighter italic">CRASHED</h2>
          <p className="text-3xl text-white font-headline font-bold mb-10">{Math.floor(score / 10)} KM TRAVELED</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold bg-primary hover:bg-primary/80">
            <RotateCcw className="mr-3 h-8 w-8" /> RESTART RACE
          </Button>
        </div>
      )}
    </div>
  );
}
