
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
    // Réduction de la densité : on ne spawn que si peu d'ennemis sont proches
    if (enemies.current.filter(e => e.z > 1500).length > 0) return;

    const laneX = (Math.floor(Math.random() * 3) - 1) * 90;
    const colors = ['#1e40af', '#dc2626', '#059669', '#d97706', '#4b5563'];
    enemies.current.push({
      x: laneX,
      z: 2500,
      speed: 1.2 + Math.random() * 3.0,
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
    gameSpeed.current += 0.00004;
    setScore(s => s + 1);

    // Spawn moins fréquent (0.02 au lieu de 0.04)
    if (Math.random() < 0.02) spawnEnemy();
    
    enemies.current.forEach(e => {
      e.z -= (gameSpeed.current * 160) + e.speed;
      if (e.z > -10 && e.z < 60) {
        const dist = Math.abs(e.x - playerX.current);
        const hitWidth = e.type === 'truck' ? 85 : 75;
        if (dist < hitWidth) setGameOver(true);
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -300);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: string = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 3.8;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.02) return;

    const carW = (type === 'truck' ? 150 : 120) * scale;
    const carH = (type === 'truck' ? 110 : 80) * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Shadow volumétrique
    const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, carW);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, carW * 1.1, carH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body principal
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 12 * scale);
    ctx.fill();

    // Reflets de carrosserie
    const bodyHighlight = ctx.createLinearGradient(-carW/2, -carH, carW/2, -carH);
    bodyHighlight.addColorStop(0, 'rgba(255,255,255,0)');
    bodyHighlight.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    bodyHighlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bodyHighlight;
    ctx.fillRect(-carW/2, -carH, carW, carH * 0.4);

    // Vitres sombres avec reflet ciel
    ctx.fillStyle = '#0a0f1e';
    ctx.beginPath();
    ctx.roundRect(-carW/2.4, -carH * 0.88, (carW/2.4)*2, carH * 0.45, 5 * scale);
    ctx.fill();

    // Éclairage réaliste
    if (isPlayer) {
      // Feux arrière avec Bloom
      ctx.fillStyle = '#ff0000';
      ctx.shadowBlur = 25 * scale;
      ctx.shadowColor = '#ff0000';
      ctx.fillRect(-carW/2 + 5, -carH * 0.6, 18 * scale, 12 * scale);
      ctx.fillRect(carW/2 - 23, -carH * 0.6, 18 * scale, 12 * scale);
    } else {
      // Phares avant avec Bloom puissant
      ctx.fillStyle = '#fffdf0';
      ctx.shadowBlur = 30 * scale;
      ctx.shadowColor = '#fffdf0';
      ctx.beginPath();
      ctx.arc(-carW/2 + 12, -carH * 0.92, 12 * scale, 0, Math.PI*2);
      ctx.arc(carW/2 - 12, -carH * 0.92, 12 * scale, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ciel atmosphérique profond
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(0.85, '#0f172a');
    skyGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Route goudronnée avec perspective
    const roadGrad = ctx.createLinearGradient(0, HORIZON, 0, CANVAS_HEIGHT);
    roadGrad.addColorStop(0, '#0f172a');
    roadGrad.addColorStop(1, '#020617');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Lignes de séparation réalistes
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = -1.5; i <= 1.5; i++) {
       const laneX = i * 140;
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (laneX * 5) - playerX.current * 5, CANVAS_HEIGHT);
       ctx.stroke();
    }

    // Marquages de route en mouvement
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 20; i++) {
      const z = i * 100 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      const dashW = 12 * scale;
      const dashLen = 50 * scale;
      
      const xL = CANVAS_WIDTH/2 - (70 * scale * 5) - (playerX.current * scale * 3.8);
      const xR = CANVAS_WIDTH/2 + (70 * scale * 5) - (playerX.current * scale * 3.8);
      
      ctx.fillRect(xL - dashW/2, y, dashW, dashLen);
      ctx.fillRect(xR - dashW/2, y, dashW, dashLen);
    }

    // Entités triées par profondeur
    const sortedEnemies = [...enemies.current].sort((a, b) => b.z - a.z);
    sortedEnemies.forEach(e => drawCar(ctx, e.x, e.z, e.color, false, e.type));
    
    // Joueur
    drawCar(ctx, playerX.current, 45, '#C41DFA', true);

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
          <h2 className="text-9xl font-headline font-bold text-destructive mb-8 tracking-tighter italic">COLLISION</h2>
          <p className="text-2xl text-white/50 mb-16 uppercase tracking-[0.6em]">Distance Totale : {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-3xl px-24 py-14 text-4xl font-bold bg-primary hover:scale-110 transition-transform shadow-2xl shadow-primary/50">
            REDÉMARRER
          </Button>
        </div>
      )}
    </div>
  );
}
