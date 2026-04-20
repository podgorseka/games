
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
  const enemies = useRef<{ x: number, z: number, speed: number, color: string, type: string, seed: number }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameSpeed = useRef(0.08); // Ralenti un peu

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
    const laneX = (Math.floor(Math.random() * 3) - 1) * 85;
    const colors = ['#1e40af', '#dc2626', '#059669', '#d97706', '#4b5563'];
    enemies.current.push({
      x: laneX,
      z: 1200, // Distance de vue plus lointaine
      speed: 1.5 + Math.random() * 3.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.85 ? 'truck' : 'car',
      seed: Math.random()
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    if (keys.current['ArrowLeft'] || keys.current['a']) targetX.current -= 8;
    if (keys.current['ArrowRight'] || keys.current['d']) targetX.current += 8;

    playerX.current += (targetX.current - playerX.current) * 0.12;
    targetX.current = Math.max(-140, Math.min(140, targetX.current));
    playerX.current = Math.max(-140, Math.min(140, playerX.current));

    roadOffset.current = (roadOffset.current + gameSpeed.current * 50) % 100;
    gameSpeed.current += 0.00004; // Accélération plus douce
    setScore(s => s + 1);

    if (Math.random() < 0.035) spawnEnemy();
    
    enemies.current.forEach(e => {
      e.z -= (gameSpeed.current * 140) + e.speed;
      if (e.z > -10 && e.z < 40) {
        const dist = Math.abs(e.x - playerX.current);
        const hitWidth = e.type === 'truck' ? 65 : 55;
        if (dist < hitWidth) setGameOver(true);
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -150);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 2.8;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.05) return;

    const carW = (type === 'truck' ? 110 : 90) * scale;
    const carH = (type === 'truck' ? 85 : 55) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Ombre portée plus réaliste
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 0.8, carH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Carrosserie avec dégradé métallique
    const grad = ctx.createLinearGradient(0, -carH, 0, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 10 * scale);
    ctx.fill();

    // Reflet de lumière sur le toit
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-carW/2.2, -carH * 0.9, carW * 0.9, carH * 0.1);

    // Vitres sombres
    ctx.fillStyle = 'rgba(10,10,30,0.95)';
    ctx.fillRect(-carW/2.4, -carH * 0.8, (carW/2.4)*2, carH * 0.35);

    // Feux
    if (isPlayer) {
      // Feux stop rouges brillants
      ctx.fillStyle = '#ff1111';
      ctx.shadowBlur = 20 * scale;
      ctx.shadowColor = '#ff0000';
      ctx.fillRect(-carW/2 + 2, -carH * 0.4, 15 * scale, 10 * scale);
      ctx.fillRect(carW/2 - 17, -carH * 0.4, 15 * scale, 10 * scale);
    } else {
      // Phares avant blancs/jaunes
      ctx.fillStyle = '#ffffcc';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowColor = '#ffffaa';
      ctx.fillRect(-carW/2 + 2, -carH * 0.95, 20 * scale, 20 * scale);
      ctx.fillRect(carW/2 - 22, -carH * 0.95, 20 * scale, 20 * scale);
    }

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ciel avec dégradé atmosphérique
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(0.7, '#1e293b');
    skyGrad.addColorStop(1, '#334155');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Ligne d'horizon vaporeuse
    const horizonGrad = ctx.createLinearGradient(0, HORIZON - 20, 0, HORIZON + 20);
    horizonGrad.addColorStop(0, 'rgba(51,65,85,0)');
    horizonGrad.addColorStop(0.5, 'rgba(196,29,250,0.3)');
    horizonGrad.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, HORIZON - 20, CANVAS_WIDTH, 40);

    // Route - Bitume avec grain
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Lignes de séparation de voies avec perspective
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = -1.5; i <= 1.5; i++) {
       const laneX = i * 110;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 - (playerX.current * (FOV/(FOV+1200))), HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (laneX * 3.5) - playerX.current * 3.5, CANVAS_HEIGHT);
       ctx.stroke();
    }

    // Marquages au sol (pointillés défilants)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 25; i++) {
      const z = i * 60 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      const dashW = 160 * scale;
      const dashLen = 20 * scale;
      
      ctx.beginPath();
      // Gauche
      ctx.moveTo(CANVAS_WIDTH/2 - dashW - (playerX.current * scale * 2.8), y);
      ctx.lineTo(CANVAS_WIDTH/2 - (dashW - dashLen) - (playerX.current * scale * 2.8), y);
      // Droite
      ctx.moveTo(CANVAS_WIDTH/2 + dashW - (playerX.current * scale * 2.8), y);
      ctx.lineTo(CANVAS_WIDTH/2 + (dashW - dashLen) - (playerX.current * scale * 2.8), y);
      ctx.stroke();
    }

    // Objets (fond vers avant)
    const sortedEnemies = [...enemies.current].sort((a, b) => b.z - a.z);
    sortedEnemies.forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));
    
    // Joueur
    drawCar(ctx, playerX.current, 25, '#C41DFA', true);

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
      <div className="absolute top-10 left-10 flex flex-col items-start z-20 pointer-events-none">
        <span className="text-xs uppercase tracking-[0.5em] font-black text-primary/40">Real Racing HUD</span>
        <div className="text-7xl font-headline font-bold text-white tracking-tighter italic shadow-xl">
          {Math.floor(score / 10)} <span className="text-xl text-primary">KM</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[98vh] shadow-2xl" />

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-8 text-center z-30 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-destructive mb-4 tracking-tighter italic">CRASH</h2>
          <p className="text-2xl text-white/40 mb-12 uppercase tracking-[0.4em]">Distance Parcourue : {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-20 py-12 text-3xl font-bold bg-primary hover:scale-110 transition-transform shadow-2xl shadow-primary/50">
            RELANCER
          </Button>
        </div>
      )}
    </div>
  );
}
