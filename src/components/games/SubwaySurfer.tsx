"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function SubwaySurfer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 700;
  const HORIZON = CANVAS_HEIGHT * 0.35; // Horizon abaissé pour plus de vue
  const FOV = 130;
  const TRAIN_HEIGHT = 280; // Trains encore plus hauts

  const playerLane = useRef(1);
  const currentX = useRef(0);
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, length: number, type: 'train' | 'barrier' | 'ramp', color: string }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(4.8);
  const frameCount = useRef(0);
  const tunnelOffset = useRef(0);

  const initGame = useCallback(() => {
    playerLane.current = 1;
    currentX.current = 0;
    playerYOffset.current = 0;
    isJumping.current = false;
    isSliding.current = false;
    obstacles.current = [];
    coinsList.current = [];
    gameSpeed.current = 4.8;
    frameCount.current = 0;
    tunnelOffset.current = 0;
    setScore(0);
    setCoins(0);
    setGameOver(false);
  }, []);

  const moveLane = (dir: number) => {
    if (gameOver) return;
    const nextLane = playerLane.current + dir;
    if (nextLane >= 0 && nextLane < 3) playerLane.current = nextLane;
  };

  const jump = () => {
    if (gameOver || isJumping.current) return;
    isJumping.current = true;
    jumpVelocity.current = 24;
    isSliding.current = false;
  };

  const slide = () => {
    if (gameOver || isSliding.current) return;
    isSliding.current = true;
    setTimeout(() => isSliding.current = false, 750);
  };

  const update = useCallback(() => {
    if (gameOver) return;

    frameCount.current++;
    setScore(s => s + 1);

    const targetX = (playerLane.current - 1) * 140;
    currentX.current += (targetX - currentX.current) * 0.25;

    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 1.0;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if (obs.type === 'train' || obs.type === 'ramp') {
        if (playerLane.current === obs.lane && obs.z < 120 && (obs.z + obs.length) > 30) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 60) {
             onTrain = true;
           }
        }
      }
    });

    const floorY = onTrain ? TRAIN_HEIGHT : 0;
    if (playerYOffset.current <= floorY) {
      playerYOffset.current = floorY;
      jumpVelocity.current = 0;
      isJumping.current = false;
    }

    tunnelOffset.current = (tunnelOffset.current + gameSpeed.current * 12) % 400;

    if (frameCount.current % 120 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const isClimbable = Math.random() > 0.6;
      obstacles.current.push({ 
        lane, 
        z: 5000, 
        length: isClimbable ? 1000 : 3500 + Math.random() * 1500, 
        type: isClimbable ? 'ramp' : 'train',
        color: isClimbable ? '#2563eb' : '#334155'
      });
    } else if (frameCount.current % 160 === 0) {
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 5000, length: 150, type: 'barrier', color: '#dc2626' });
    }

    if (frameCount.current % 70 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 5000 });

    gameSpeed.current += 0.0006;

    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 9;
      if (obj.lane === playerLane.current && obj.z < 110 && (obj.z + obj.length) > 35) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.5;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 70) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && !isSliding.current && playerYOffset.current < 90) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 9;
      if (c.lane === playerLane.current && c.z > 15 && c.z < 150) {
        if (Math.abs(playerYOffset.current - 0) < 150 || Math.abs(playerYOffset.current - TRAIN_HEIGHT) < 150) {
           setCoins(prev => prev + 1);
           c.z = -7000;
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => (o.z + o.length) > -800);
    coinsList.current = coinsList.current.filter(c => c.z > -800);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * 2.2, scale * 2.2); // Taille réduite pour visibilité

    const bodyH = isSliding.current ? 45 : 85;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.ellipse(0, 5, 25, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Hoodie & Body
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath(); ctx.roundRect(-18, -bodyH - 20, 36, bodyH, 12); ctx.fill();
    
    // Pants
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-14, -25, 10, 25);
    ctx.fillRect(4, -25, 10, 25);

    // Backpack
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath(); ctx.roundRect(-15, -bodyH - 5, 30, 45, 6); ctx.fill();

    // Head
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath(); ctx.arc(0, -bodyH - 35, 18, 0, Math.PI * 2); ctx.fill();
    
    // Cap
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(0, -bodyH - 45, 11, 0, Math.PI, true); ctx.fill();

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Tunnel Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.35, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Rail System
    for (let i = 0; i < 30; i++) {
      const z = (i * 200 - tunnelOffset.current + 6000) % 6000;
      const s = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * s;
      const tieW = 400 * s;
      
      ctx.fillStyle = '#451a03';
      ctx.fillRect(CANVAS_WIDTH/2 - tieW/2, y, tieW, 12 * s);
    }

    // Steel Rails
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 5;
    [-1.2, -0.4, 0.4, 1.2].forEach(rx => {
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 + rx * 20, HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + rx * 450, CANVAS_HEIGHT);
       ctx.stroke();
    });

    const all = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin' as const, color: '#facc15'}) )
    ].sort((a, b) => b.z - a.z);

    all.forEach(obj => {
      const scaleS = FOV / (FOV + obj.z);
      const scaleE = FOV / (FOV + (obj.z + (obj.length || 0)));
      const laneX = (obj.lane - 1) * 175;
      
      const xS = CANVAS_WIDTH / 2 + laneX * scaleS * 5.8;
      const xE = CANVAS_WIDTH / 2 + laneX * scaleE * 5.8;
      const yS = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleS;
      const yE = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleE;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const wS = 180 * scaleS; const wE = 180 * scaleE;
        const hS = TRAIN_HEIGHT * scaleS; const hE = TRAIN_HEIGHT * scaleE;

        // Sides and Roof (3D Volume)
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS - hS); ctx.lineTo(xE - wE/2, yE - hE);
        ctx.lineTo(xE + wE/2, yE - hE); ctx.lineTo(xS + wS/2, yS - hS);
        ctx.fill();
        
        // Front Face (Massive)
        if (obj.z > 40) {
           ctx.fillStyle = '#1e293b';
           ctx.fillRect(xS - wS/2, yS - hS, wS, hS);
           ctx.strokeStyle = 'rgba(255,255,255,0.15)';
           ctx.strokeRect(xS - wS/2, yS - hS, wS, hS);
           
           // Windows/Lights
           ctx.fillStyle = 'rgba(255,255,255,0.05)';
           ctx.fillRect(xS - wS/2.2, yS - hS * 0.85, wS * 0.9, hS * 0.4);
        }

        // Texture Ribs
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        for(let r=0; r<10; r++) {
           const rZ = obj.z + (obj.length / 10) * r;
           const rs = FOV / (FOV + rZ);
           const rx = CANVAS_WIDTH/2 + laneX * rs * 5.8;
           const ry = HORIZON + (CANVAS_HEIGHT - HORIZON) * rs;
           const rw = 180 * rs;
           const rh = TRAIN_HEIGHT * rs;
           ctx.beginPath(); ctx.moveTo(rx - rw/2, ry); ctx.lineTo(rx - rw/2, ry - rh); ctx.stroke();
        }

        if (obj.type === 'ramp') {
           ctx.fillStyle = '#3b82f6';
           ctx.beginPath();
           ctx.moveTo(xS - wS/3, yS); ctx.lineTo(xS, yS - hS); ctx.lineTo(xS + wS/3, yS);
           ctx.fill();
        }
      } else if (obj.type === 'barrier') {
        const bW = 160 * scaleS; const bH = 100 * scaleS;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(xS - bW/2, yS - bH, bW, bH);
        ctx.fillStyle = '#fff';
        ctx.fillRect(xS - bW/2, yS - bH * 0.7, bW, 15 * scaleS);
      } else if (obj.type === 'coin') {
        const cs = 60 * scaleS;
        ctx.fillStyle = '#facc15';
        ctx.shadowBlur = 15; ctx.shadowColor = '#facc15';
        ctx.beginPath(); ctx.arc(xS, yS - 100 * scaleS, cs/2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    const pScale = FOV / (FOV + 110);
    const px = CANVAS_WIDTH / 2 + currentX.current * pScale * 2.5;
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * pScale) - playerYOffset.current * pScale;
    drawCharacter(ctx, px, py, pScale);

  }, [score, coins, tunnelOffset.current, HORIZON]);

  const touchStart = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30) moveLane(1);
      else if (dx < -30) moveLane(-1);
    } else {
      if (dy < -30) jump();
      else if (dy > 30) slide();
    }
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') moveLane(-1);
      if (e.key === 'ArrowRight') moveLane(1);
      if (e.key === 'ArrowUp' || e.key === ' ') jump();
      if (e.key === 'ArrowDown') slide();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameOver]);

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10) + coins * 50); }, [gameOver, score, coins, onGameOver]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden touch-none select-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-20 pointer-events-none">
          <div className="flex flex-col">
             <div className="text-6xl font-headline font-bold text-white italic tracking-tighter drop-shadow-2xl">
                {Math.floor(score / 10).toLocaleString()}<span className="text-xl text-primary ml-1">M</span>
             </div>
          </div>
          <div className="flex items-center gap-3 bg-yellow-400 px-5 py-3 rounded-2xl shadow-2xl border-2 border-yellow-600">
             <span className="text-yellow-900 font-black text-3xl">{coins}</span>
             <div className="w-8 h-8 bg-yellow-600 rounded-full border-2 border-yellow-200 flex items-center justify-center">
                <span className="text-xs text-white font-bold">$</span>
             </div>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={700} className="w-full h-auto max-h-[98vh] shadow-2xl" />
      
      {!gameOver && (
        <div className="absolute bottom-12 text-white/30 font-bold uppercase tracking-[0.4em] text-xs animate-pulse">
           Swipe to Surf
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-8xl font-headline font-bold text-white tracking-tighter italic mb-12 drop-shadow-2xl">CAUGHT!</h2>
          <div className="flex gap-8 mb-20">
             <div className="bg-white/5 px-8 py-6 rounded-2xl border border-white/10">
                <p className="text-4xl font-bold">{Math.floor(score / 10)}M</p>
                <p className="text-[10px] uppercase text-white/30 tracking-widest">Distance</p>
             </div>
             <div className="bg-white/5 px-8 py-6 rounded-2xl border border-white/10">
                <p className="text-4xl font-bold text-yellow-500">{coins}</p>
                <p className="text-[10px] uppercase text-white/30 tracking-widest">Loot</p>
             </div>
          </div>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-20 py-14 text-3xl font-bold bg-primary hover:scale-105 transition-transform shadow-2xl border-b-8 border-primary/50">
            RETRY
          </Button>
        </div>
      )}
    </div>
  );
}
