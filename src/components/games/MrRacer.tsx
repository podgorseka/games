
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
    if (enemies.current.filter(e => e.z > 2000).length > 2) return;

    const lanes = [-110, 0, 110];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    const colors = ['#1e40af', '#dc2626', '#059669', '#d97706', '#4b5563', '#ffffff'];
    enemies.current.push({
      x: laneX,
      z: 3500,
      speed: 0.05 + Math.random() * 0.04, 
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.8 ? 'truck' : 'car'
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    // Commandes de direction (clic sur les côtés)
    if (keys.current['ArrowLeft'] || keys.current['a'] || keys.current['LeftTouch']) targetX.current -= 12;
    if (keys.current['ArrowRight'] || keys.current['d'] || keys.current['RightTouch']) targetX.current += 12;

    // Contrôle de la vitesse (Pédales)
    if (keys.current['Accel']) targetSpeed.current = Math.min(0.28, targetSpeed.current + 0.003);
    else if (keys.current['Brake']) targetSpeed.current = Math.max(0.06, targetSpeed.current - 0.006);
    else targetSpeed.current = Math.max(0.12, targetSpeed.current - 0.001);

    playerSpeed.current += (targetSpeed.current - playerSpeed.current) * 0.12;
    playerX.current += (targetX.current - playerX.current) * 0.2;
    
    targetX.current = Math.max(-160, Math.min(160, targetX.current));
    playerX.current = Math.max(-160, Math.min(160, playerX.current));

    roadOffset.current = (roadOffset.current + playerSpeed.current * 90) % 200;
    setScore(s => s + Math.floor(playerSpeed.current * 15));

    if (Math.random() < 0.012) spawnEnemy();
    
    enemies.current.forEach(e => {
      // Les voitures roulent dans le même sens, donc on les dépasse si on va plus vite
      const relativeSpeed = (playerSpeed.current - e.speed) * 190;
      e.z -= relativeSpeed;

      // Détection de collision précise sur le volume
      const carW = e.type === 'truck' ? 70 : 50;
      if (e.z > -20 && e.z < 60) {
        const dist = Math.abs(e.x - playerX.current);
        if (dist < carW) {
          setGameOver(true);
        }
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -1000);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 4.5;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.01) return;

    const carW = (type === 'truck' ? 180 : 140) * scale;
    const carH = (type === 'truck' ? 160 : 110) * scale; // Hauteur augmentée
    const depth = (type === 'truck' ? 120 : 70) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Ombre portée
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 0.7, carH * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arrière du véhicule (Face principale)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 10 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.stroke();

    // Toit en perspective
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.moveTo(-carW/2, -carH);
    ctx.lineTo(carW/2, -carH);
    ctx.lineTo(carW/2.5, -carH - depth);
    ctx.lineTo(-carW/2.5, -carH - depth);
    ctx.closePath();
    ctx.fill();

    // Lunette arrière (Vitre)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-carW/2.5, -carH * 0.9, (carW/2.5)*2, carH * 0.5, 4 * scale);
    ctx.fill();

    // Feux arrière (Halo lumineux)
    ctx.shadowBlur = 15 * scale;
    ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-carW/2 + 10 * scale, -carH * 0.65, 25 * scale, 12 * scale);
    ctx.fillRect(carW/2 - 35 * scale, -carH * 0.65, 25 * scale, 12 * scale);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ciel atmosphérique
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Route cinématique
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Lignes de fuite et délimitation des voies
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
       const laneX = i * 160;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (laneX * 8) - playerX.current * 8, CANVAS_HEIGHT);
       ctx.stroke();
    }

    // Marquages au sol dynamiques
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (let i = 0; i < 15; i++) {
      const z = i * 200 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      const dashW = 10 * scale;
      const dashL = 90 * scale;
      
      const lanes = [-80, 80];
      lanes.forEach(lx => {
          const x = CANVAS_WIDTH/2 + (lx * scale * 5) - (playerX.current * scale * 4.5);
          ctx.fillRect(x - dashW/2, y, dashW, dashL);
      });
    }

    // Dessin des véhicules triés par distance
    const all = [...enemies.current].sort((a, b) => b.z - a.z);
    all.forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));
    
    // Dessin du joueur (fixé à Z=50)
    drawCar(ctx, playerX.current, 50, '#C41DFA', true);

  }, [score, roadOffset.current]);

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
        keys.current[e.key] = true;
    };
    const handleUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') keys.current['Accel'] = false;
        if (e.key === 'ArrowDown') keys.current['Brake'] = false;
        keys.current[e.key] = false;
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10)); }, [gameOver, score, onGameOver]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#020617] overflow-hidden touch-none select-none">
      {/* Zones tactiles latérales invisibles */}
      <div className="absolute inset-0 z-10 flex">
          <div 
            className="flex-1" 
            onPointerDown={() => keys.current['LeftTouch'] = true} 
            onPointerUp={() => keys.current['LeftTouch'] = false} 
            onPointerLeave={() => keys.current['LeftTouch'] = false}
          />
          <div 
            className="flex-1" 
            onPointerDown={() => keys.current['RightTouch'] = true} 
            onPointerUp={() => keys.current['RightTouch'] = false} 
            onPointerLeave={() => keys.current['RightTouch'] = false}
          />
      </div>

      <div className="absolute top-12 left-12 flex flex-col items-start z-20 pointer-events-none">
        <div className="text-8xl font-headline font-bold text-white tracking-tighter italic drop-shadow-2xl">
          {Math.floor(score / 10)} <span className="text-2xl text-primary">KM</span>
        </div>
        <div className="text-primary font-bold tracking-widest uppercase text-sm mt-2 flex items-center gap-2">
            <Zap className="h-4 w-4 fill-current" /> {Math.floor(playerSpeed.current * 1200)} KM/H
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[95vh]" />

      {!gameOver && (
          <div className="absolute bottom-12 inset-x-8 flex justify-between z-30 pointer-events-none">
              <div 
                  className="w-24 h-32 bg-white/5 border border-white/10 rounded-3xl flex flex-col items-center justify-center pointer-events-auto active:bg-red-500/20 active:border-red-500/40 transition-all active:scale-95"
                  onPointerDown={() => keys.current['Brake'] = true}
                  onPointerUp={() => keys.current['Brake'] = false}
                  onPointerLeave={() => keys.current['Brake'] = false}
              >
                  <div className="text-white/30 text-[10px] font-bold uppercase mb-2">Brake</div>
                  <div className="w-12 h-1.5 bg-white/10 rounded-full" />
              </div>

              <div 
                  className="w-24 h-40 bg-white/5 border border-white/10 rounded-3xl flex flex-col items-center justify-center pointer-events-auto active:bg-primary/20 active:border-primary/40 transition-all active:scale-95"
                  onPointerDown={() => keys.current['Accel'] = true}
                  onPointerUp={() => keys.current['Accel'] = false}
                  onPointerLeave={() => keys.current['Accel'] = false}
              >
                  <div className="text-white/30 text-[10px] font-bold uppercase mb-2">Accel</div>
                  <div className="w-8 h-20 bg-primary/20 rounded-xl border border-primary/30" />
              </div>
          </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-destructive mb-8 tracking-tighter italic">CRASH</h2>
          <p className="text-2xl text-white/50 mb-16 uppercase tracking-[0.6em]">Distance parcourue : {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-3xl px-24 py-14 text-4xl font-bold bg-primary hover:scale-110 transition-transform shadow-2xl">
            REESSAYER
          </Button>
        </div>
      )}
    </div>
  );
}
