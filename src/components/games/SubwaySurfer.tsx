
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
  const CANVAS_HEIGHT = 600;
  const HORIZON = CANVAS_HEIGHT * 0.45;
  const FOV = 90;
  const TRAIN_HEIGHT = 65;

  const playerLane = useRef(1);
  const currentX = useRef(0);
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, length: number, type: 'train' | 'barrier' | 'ramp', color: string }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(4.2);
  const frameCount = useRef(0);

  const initGame = useCallback(() => {
    playerLane.current = 1;
    currentX.current = 0;
    playerYOffset.current = 0;
    isJumping.current = false;
    isSliding.current = false;
    obstacles.current = [];
    coinsList.current = [];
    gameSpeed.current = 4.2;
    frameCount.current = 0;
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
    jumpVelocity.current = 16;
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

    const targetX = (playerLane.current - 1) * 125;
    currentX.current += (targetX - currentX.current) * 0.22;

    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.9;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if (obs.type === 'train' || obs.type === 'ramp') {
        if (playerLane.current === obs.lane && obs.z < 60 && (obs.z + obs.length) > 20) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 10) {
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

    if (frameCount.current % 80 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const isRamp = Math.random() > 0.7;
      obstacles.current.push({ 
        lane, 
        z: 1000, 
        length: isRamp ? 300 : 600 + Math.random() * 600, 
        type: isRamp ? 'ramp' : 'train',
        color: ['#1e3a8a', '#1e40af', '#172554'][Math.floor(Math.random() * 3)]
      });
    } else if (frameCount.current % 120 === 0) {
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 1000, length: 40, type: 'barrier', color: '#dc2626' });
    }

    if (frameCount.current % 40 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 1000 });

    gameSpeed.current += 0.001;

    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 8;
      if (obj.lane === playerLane.current && obj.z < 45 && (obj.z + obj.length) > 25) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.4;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 15) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && !isSliding.current && playerYOffset.current < 40) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 8;
      if (c.lane === playerLane.current && c.z > 20 && c.z < 60) {
        const charY = playerYOffset.current;
        if (Math.abs(charY - 0) < 50 || Math.abs(charY - TRAIN_HEIGHT) < 50) {
           setCoins(prev => prev + 1);
           c.z = -500;
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => (o.z + o.length) > -100);
    coinsList.current = coinsList.current.filter(c => c.z > -100);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bodyH = isSliding.current ? 30 : 60;
    
    // Ombre
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 0, 25, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Silhouette humanoïde stylisée
    ctx.fillStyle = '#C41DFA';
    ctx.beginPath(); ctx.roundRect(-18, -bodyH - 20, 36, bodyH, 15); ctx.fill();
    
    // Détail T-shirt
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(-18, -bodyH - 10, 36, 12);

    // Tête
    ctx.fillStyle = '#fdb';
    ctx.beginPath(); ctx.arc(0, -bodyH - 40, 16, 0, Math.PI * 2); ctx.fill();
    
    // Casquette
    ctx.fillStyle = '#FA1D64';
    ctx.beginPath(); ctx.roundRect(-16, -bodyH - 56, 32, 12, 5); ctx.fill();
    ctx.fillRect(0, -bodyH - 56, 25, 5);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Tunnel / Ciel
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617'); sky.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Sol béton
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Rails qui convergent
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 3;
    for (let i = 0; i <= 3; i++) {
      const laneX = (i - 1.5) * 125;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
      ctx.lineTo(CANVAS_WIDTH/2 + laneX * 18, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Objets (fond vers avant)
    const all = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin', color: '#FAC11D'}))
    ].sort((a, b) => b.z - a.z);

    all.forEach(obj => {
      const scaleS = FOV / (FOV + obj.z);
      const scaleE = FOV / (FOV + obj.z + obj.length);
      const laneX = (obj.lane - 1) * 125;
      
      const xS = CANVAS_WIDTH / 2 + laneX * scaleS * 4;
      const xE = CANVAS_WIDTH / 2 + laneX * scaleE * 4;
      const yS = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleS;
      const yE = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleE;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const wS = 120 * scaleS; const wE = 120 * scaleE;
        const hS = TRAIN_HEIGHT * scaleS; const hE = TRAIN_HEIGHT * scaleE;

        const grad = ctx.createLinearGradient(xS, yS, xS, yS - hS);
        grad.addColorStop(0, '#1e40af'); grad.addColorStop(1, '#3b82f6');
        ctx.fillStyle = grad;
        
        // Corps du train
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS); ctx.lineTo(xE - wE/2, yE);
        ctx.lineTo(xE + wE/2, yE); ctx.lineTo(xS + wS/2, yS);
        ctx.fill();
        
        // Toit
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS - hS); ctx.lineTo(xE - wE/2, yE - hE);
        ctx.lineTo(xE + wE/2, yE - hE); ctx.lineTo(xS + wS/2, yS - hS);
        ctx.fill();

        // Reflets vitres
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(xS - wS/2.5, yS - hS * 0.7, wS * 0.8, hS * 0.3);
      } else if (obj.type === 'barrier') {
        const bW = 100 * scaleS; const bH = 50 * scaleS;
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(xS - bW/2, yS - bH, bW, bH);
        ctx.fillStyle = '#fff';
        ctx.fillRect(xS - bW/2, yS - bH/2 - 2, bW, 4);
      } else if (obj.type === 'coin') {
        const cs = 40 * scaleS;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 10; ctx.shadowColor = '#fbbf24';
        ctx.beginPath(); ctx.arc(xS, yS - 30 * scaleS, cs/2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Personnage (caméra fixe)
    const pScale = FOV / (FOV + 45);
    const px = CANVAS_WIDTH / 2 + currentX.current * pScale * 1.5;
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * pScale) - playerYOffset.current * pScale;
    drawCharacter(ctx, px, py, pScale * 1.8);

  }, [score, coins, isSliding]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  const touchStart = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 35) moveLane(1);
      else if (dx < -35) moveLane(-1);
    } else {
      if (dy < -35) jump();
      else if (dy > 35) slide();
    }
  };

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

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10) + coins * 10); }, [gameOver, score, coins, onGameOver]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden touch-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="absolute top-10 left-10 flex flex-col items-start gap-1 z-20 pointer-events-none">
          <div className="text-5xl font-headline font-bold text-white italic tracking-tighter shadow-sm">
             {Math.floor(score / 10)}<span className="text-xl text-primary ml-1 uppercase">M</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/30 px-3 py-1 rounded-full border border-yellow-500/40">
             <span className="text-yellow-400 font-bold">{coins} COINS</span>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[92vh]" />
      
      {!gameOver && (
        <div className="absolute bottom-12 text-white/20 text-xs font-bold uppercase tracking-[0.6em] animate-pulse">
           Swipe to run
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-8 text-center z-30 backdrop-blur-2xl">
          <h2 className="text-9xl font-headline font-bold text-white tracking-tighter italic mb-8">CAUGHT</h2>
          <div className="flex gap-4 mb-16">
             <div className="bg-white/5 px-8 py-6 rounded-3xl border border-white/10">
                <p className="text-3xl font-bold">{Math.floor(score / 10)}M</p>
             </div>
             <div className="bg-white/5 px-8 py-6 rounded-3xl border border-white/10">
                <p className="text-3xl font-bold text-yellow-500">{coins}</p>
             </div>
          </div>
          <Button onClick={initGame} size="lg" className="rounded-full px-20 py-12 text-3xl font-bold bg-primary hover:bg-primary/90 transition-all hover:scale-105 shadow-2xl shadow-primary/40">
            RUN AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
