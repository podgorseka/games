
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
  const HORIZON = CANVAS_HEIGHT * 0.42; // Plus bas pour plus d'immersion
  const FOV = 80;
  
  const playerX = useRef(0);
  const targetX = useRef(0);
  const enemies = useRef<{ x: number, z: number, speed: number, color: string, type: string }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameSpeed = useRef(0.12);

  const initGame = useCallback(() => {
    playerX.current = 0;
    targetX.current = 0;
    enemies.current = [];
    roadOffset.current = 0;
    gameSpeed.current = 0.12;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    const laneX = (Math.floor(Math.random() * 3) - 1) * 85;
    const colors = ['#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D', '#555'];
    enemies.current.push({
      x: laneX,
      z: 800,
      speed: 1.8 + Math.random() * 4.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.82 ? 'truck' : 'car'
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    if (keys.current['ArrowLeft'] || keys.current['a']) targetX.current -= 10;
    if (keys.current['ArrowRight'] || keys.current['d']) targetX.current += 10;

    playerX.current += (targetX.current - playerX.current) * 0.15;
    targetX.current = Math.max(-140, Math.min(140, targetX.current));
    playerX.current = Math.max(-140, Math.min(140, playerX.current));

    roadOffset.current = (roadOffset.current + gameSpeed.current * 40) % 100;
    gameSpeed.current += 0.00006;
    setScore(s => s + 1);

    if (Math.random() < 0.045) spawnEnemy();
    
    enemies.current.forEach(e => {
      e.z -= (gameSpeed.current * 130) + e.speed;
      if (e.z > -15 && e.z < 35) {
        const dist = Math.abs(e.x - playerX.current);
        const hitWidth = e.type === 'truck' ? 60 : 50;
        if (dist < hitWidth) setGameOver(true);
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -100);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 2.5;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON) return;

    const carW = (type === 'truck' ? 100 : 80) * scale;
    const carH = (type === 'truck' ? 75 : 50) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Ombre portée
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 0.9, carH * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Carrosserie avec dégradé
    const grad = ctx.createLinearGradient(0, -carH, 0, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 8 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vitres
    ctx.fillStyle = 'rgba(10,10,20,0.9)';
    ctx.fillRect(-carW/2.5, -carH * 0.85, (carW/2.5)*2, carH * 0.4);

    // Feux arrière (Player) ou avant (Enemies)
    if (isPlayer) {
      ctx.fillStyle = '#ff0000';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowColor = 'red';
      ctx.fillRect(-carW/2 + 2, -carH * 0.4, 12 * scale, 8 * scale);
      ctx.fillRect(carW/2 - 14, -carH * 0.4, 12 * scale, 8 * scale);
    } else {
      ctx.fillStyle = '#ffffaa';
      ctx.shadowBlur = 10 * scale;
      ctx.shadowColor = 'yellow';
      ctx.fillRect(-carW/2 + 2, -carH * 0.95, 15 * scale, 15 * scale);
      ctx.fillRect(carW/2 - 17, -carH * 0.95, 15 * scale, 15 * scale);
    }

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ciel Cyberpunk
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Ligne d'horizon lumineuse
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#C41DFA';
    ctx.strokeStyle = '#C41DFA';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(CANVAS_WIDTH, HORIZON); ctx.stroke();
    ctx.shadowBlur = 0;

    // Route - Goudron sombre
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Lignes de séparation des voies
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([40, 40]);
    for (let i = -1; i <= 1; i += 2) {
       const laneX = i * 85;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 - (playerX.current * (FOV/(FOV+800))), HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (laneX * 2.5) - playerX.current * 2.5, CANVAS_HEIGHT);
       ctx.stroke();
    }
    ctx.setLineDash([]);

    // Effet de défilement central (pointillés)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    for (let i = 0; i < 20; i++) {
      const z = i * 60 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      const dashW = 140 * scale;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2 - dashW - (playerX.current * scale * 2.5), y);
      ctx.lineTo(CANVAS_WIDTH/2 - (dashW - 20 * scale) - (playerX.current * scale * 2.5), y);
      ctx.moveTo(CANVAS_WIDTH/2 + dashW - (playerX.current * scale * 2.5), y);
      ctx.lineTo(CANVAS_WIDTH/2 + (dashW - 20 * scale) - (playerX.current * scale * 2.5), y);
      ctx.stroke();
    }

    // Dessin des voitures (fond vers avant)
    enemies.current.sort((a, b) => b.z - a.z).forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));
    drawCar(ctx, playerX.current, 20, '#C41DFA', true);

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
      <div className="absolute top-8 left-8 flex flex-col items-start z-20 pointer-events-none">
        <span className="text-xs uppercase tracking-[0.4em] font-black text-primary/60">Speed Limit: None</span>
        <div className="text-6xl font-headline font-bold text-white tracking-tighter italic shadow-primary">
          {Math.floor(score / 10)} <span className="text-xl text-primary">KM</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[95vh]" />

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8 text-center z-30 backdrop-blur-xl">
          <h2 className="text-8xl font-headline font-bold text-destructive mb-4 tracking-tighter italic">CRASHED</h2>
          <p className="text-2xl text-white/50 mb-12 uppercase tracking-[0.3em]">Distance : {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-16 py-10 text-3xl font-bold bg-primary hover:scale-110 transition-transform shadow-2xl shadow-primary/40">
            TRY AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
