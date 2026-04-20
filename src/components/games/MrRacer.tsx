
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Zap, Target } from 'lucide-react';

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
  const playerSpeed = useRef(0.1); // Vitesse actuelle du joueur
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
    // Densité réduite : un seul véhicule à la fois si la voie est dégagée devant
    if (enemies.current.filter(e => e.z > 1000).length > 0) return;

    const laneX = (Math.floor(Math.random() * 3) - 1) * 90;
    const colors = ['#1e40af', '#dc2626', '#059669', '#d97706', '#4b5563'];
    enemies.current.push({
      x: laneX,
      z: 3000,
      // Les ennemis vont moins vite que le joueur (pour être doublés)
      speed: 0.04 + Math.random() * 0.03, 
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.8 ? 'truck' : 'car'
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    // Contrôles de direction
    if (keys.current['ArrowLeft'] || keys.current['a']) targetX.current -= 8;
    if (keys.current['ArrowRight'] || keys.current['d']) targetX.current += 8;

    // Gestion de la vitesse (Pédales)
    if (keys.current['Accel']) targetSpeed.current = Math.min(0.25, targetSpeed.current + 0.002);
    else if (keys.current['Brake']) targetSpeed.current = Math.max(0.05, targetSpeed.current - 0.004);
    else targetSpeed.current = Math.max(0.1, targetSpeed.current - 0.001); // Décélération naturelle

    playerSpeed.current += (targetSpeed.current - playerSpeed.current) * 0.1;

    // Interpolation position joueur
    playerX.current += (targetX.current - playerX.current) * 0.15;
    targetX.current = Math.max(-150, Math.min(150, targetX.current));
    playerX.current = Math.max(-150, Math.min(150, playerX.current));

    // Mouvement de la route
    roadOffset.current = (roadOffset.current + playerSpeed.current * 80) % 100;
    setScore(s => s + Math.floor(playerSpeed.current * 10));

    // Spawn
    if (Math.random() < 0.015) spawnEnemy();
    
    // Mise à jour des ennemis (Dépassement)
    enemies.current.forEach(e => {
      // La vitesse relative : si playerSpeed > e.speed, l'ennemi se rapproche de nous (Z diminue)
      const relativeSpeed = (playerSpeed.current - e.speed) * 180;
      e.z -= relativeSpeed;

      // Collision
      if (e.z > -10 && e.z < 70) {
        const dist = Math.abs(e.x - playerX.current);
        const hitWidth = e.type === 'truck' ? 80 : 70;
        if (dist < hitWidth) setGameOver(true);
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -500);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 4.2;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.02) return;

    const carW = (type === 'truck' ? 160 : 130) * scale;
    const carH = (type === 'truck' ? 120 : 90) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Ombre portée
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 0.6, carH * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Carrosserie
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 15 * scale);
    ctx.fill();

    // Reflets
    const grad = ctx.createLinearGradient(-carW/2, -carH, carW/2, -carH);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-carW/2, -carH, carW, carH * 0.4);

    // Vitre arrière
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-carW/2.5, -carH * 0.9, (carW/2.5)*2, carH * 0.4, 5 * scale);
    ctx.fill();

    // Feux ARRIÈRE rouges (On suit tout le monde)
    ctx.fillStyle = '#ff0000';
    ctx.shadowBlur = 20 * scale;
    ctx.shadowColor = '#ff0000';
    ctx.fillRect(-carW/2 + 8, -carH * 0.6, 20 * scale, 12 * scale);
    ctx.fillRect(carW/2 - 28, -carH * 0.6, 20 * scale, 12 * scale);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ciel
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(1, '#0f172a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Route
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Marquages rails/voies
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    for (let i = -1.5; i <= 1.5; i++) {
       const laneX = i * 140;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (laneX * 6) - playerX.current * 6, CANVAS_HEIGHT);
       ctx.stroke();
    }

    // Lignes discontinues en mouvement
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 15; i++) {
      const z = i * 150 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      const dashW = 10 * scale;
      const dashL = 60 * scale;
      const xL = CANVAS_WIDTH/2 - (70 * scale * 6) - (playerX.current * scale * 4.2);
      const xR = CANVAS_WIDTH/2 + (70 * scale * 6) - (playerX.current * scale * 4.2);
      ctx.fillRect(xL - dashW/2, y, dashW, dashL);
      ctx.fillRect(xR - dashW/2, y, dashW, dashL);
    }

    // Entités
    const all = [...enemies.current].sort((a, b) => b.z - a.z);
    all.forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));
    drawCar(ctx, playerX.current, 50, '#C41DFA', true);

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
    <div 
        className="relative w-full h-full flex flex-col items-center justify-center bg-[#020617] overflow-hidden touch-none select-none"
        onPointerDown={(e) => handlePointer(e.clientX, true)}
        onPointerUp={() => handlePointer(0, false)}
    >
      {/* Score HUD */}
      <div className="absolute top-12 left-12 flex flex-col items-start z-20 pointer-events-none">
        <div className="text-8xl font-headline font-bold text-white tracking-tighter italic drop-shadow-2xl">
          {Math.floor(score / 10)} <span className="text-2xl text-primary">KM</span>
        </div>
        <div className="text-primary font-bold tracking-widest uppercase text-sm mt-2 flex items-center gap-2">
            <Zap className="h-4 w-4 fill-current" /> {Math.floor(playerSpeed.current * 1000)} KM/H
        </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[95vh] shadow-2xl" />

      {/* Pédales Virtuelles (Touch) */}
      {!gameOver && (
          <div className="absolute bottom-12 inset-x-8 flex justify-between z-30 pointer-events-none">
              <div 
                  className="w-24 h-32 bg-white/5 border-2 border-white/10 rounded-2xl flex flex-col items-center justify-center pointer-events-auto active:bg-red-500/20 active:border-red-500/50 transition-colors"
                  onPointerDown={() => keys.current['Brake'] = true}
                  onPointerUp={() => keys.current['Brake'] = false}
                  onPointerLeave={() => keys.current['Brake'] = false}
              >
                  <div className="text-white/40 text-[10px] font-bold uppercase mb-2">Brake</div>
                  <div className="w-12 h-1 bg-white/20 rounded-full" />
              </div>

              <div 
                  className="w-24 h-40 bg-white/5 border-2 border-white/10 rounded-2xl flex flex-col items-center justify-center pointer-events-auto active:bg-primary/20 active:border-primary/50 transition-colors"
                  onPointerDown={() => keys.current['Accel'] = true}
                  onPointerUp={() => keys.current['Accel'] = false}
                  onPointerLeave={() => keys.current['Accel'] = false}
              >
                  <div className="text-white/40 text-[10px] font-bold uppercase mb-2">Accel</div>
                  <div className="w-8 h-20 bg-primary/20 rounded-lg border border-primary/30" />
              </div>
          </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-destructive mb-8 tracking-tighter italic">CRASH</h2>
          <p className="text-2xl text-white/50 mb-16 uppercase tracking-[0.6em]">Score : {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-3xl px-24 py-14 text-4xl font-bold bg-primary hover:scale-110 transition-transform shadow-2xl shadow-primary/50">
            REESSAYER
          </Button>
        </div>
      )}
    </div>
  );
}
