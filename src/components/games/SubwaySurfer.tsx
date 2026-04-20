
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
  const HORIZON = CANVAS_HEIGHT * 0.35;
  const FOV = 130;
  const TRAIN_HEIGHT = 220;

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
  const tunnelOffset = useRef(0);

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
    jumpVelocity.current = 20;
    isSliding.current = false;
  };

  const slide = () => {
    if (gameOver || isSliding.current) return;
    isSliding.current = true;
    setTimeout(() => isSliding.current = false, 700);
  };

  const update = useCallback(() => {
    if (gameOver) return;

    frameCount.current++;
    setScore(s => s + 1);

    const targetX = (playerLane.current - 1) * 145;
    currentX.current += (targetX - currentX.current) * 0.2;

    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.9;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if ((obs.type === 'train' || obs.type === 'ramp') && playerLane.current === obs.lane) {
        if (obs.z < 130 && (obs.z + obs.length) > 30) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 50) onTrain = true;
        }
      }
    });

    const floorY = onTrain ? TRAIN_HEIGHT : 0;
    if (playerYOffset.current <= floorY) {
      playerYOffset.current = floorY;
      jumpVelocity.current = 0;
      isJumping.current = false;
    }

    tunnelOffset.current = (tunnelOffset.current + gameSpeed.current * 10) % 500;

    if (frameCount.current % 130 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const isClimbable = Math.random() > 0.65;
      obstacles.current.push({ 
        lane, 
        z: 6000, 
        length: isClimbable ? 800 : 3800 + Math.random() * 1000, 
        type: isClimbable ? 'ramp' : 'train',
        color: isClimbable ? '#2563eb' : '#334155'
      });
    } else if (frameCount.current % 180 === 0) {
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 6000, length: 140, type: 'barrier', color: '#b91c1c' });
    }

    if (frameCount.current % 60 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 6000 });

    gameSpeed.current += 0.0004;

    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 10;
      if (obj.lane === playerLane.current && obj.z < 100 && (obj.z + obj.length) > 20) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.4;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 60) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && !isSliding.current && playerYOffset.current < 80) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 10;
      if (c.lane === playerLane.current && c.z > 20 && c.z < 150) {
        if (Math.abs(playerYOffset.current - 0) < 120 || Math.abs(playerYOffset.current - TRAIN_HEIGHT) < 120) {
           setCoins(prev => prev + 1);
           c.z = -8000;
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => (o.z + o.length) > -1000);
    coinsList.current = coinsList.current.filter(c => c.z > -1000);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * 1.8, scale * 1.8);

    const bodyH = isSliding.current ? 40 : 80;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 5, 20, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.roundRect(-16, -bodyH - 20, 32, bodyH, 10); ctx.fill();
    
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(-13, -20, 9, 20);
    ctx.fillRect(4, -20, 9, 20);

    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.roundRect(-12, -bodyH - 5, 24, 40, 5); ctx.fill();

    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath(); ctx.arc(0, -bodyH - 30, 16, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(0, -bodyH - 40, 10, 0, Math.PI, true); ctx.fill();

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.35, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let i = 0; i < 35; i++) {
      const z = (i * 200 - tunnelOffset.current + 7000) % 7000;
      const s = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * s;
      const tieW = 450 * s;
      
      ctx.fillStyle = '#27272a';
      ctx.fillRect(CANVAS_WIDTH/2 - tieW/2, y, tieW, 10 * s);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(CANVAS_WIDTH/2 - tieW/2, y + 8 * s, tieW, 2 * s);
    }

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    [-1.25, -0.45, 0.45, 1.25].forEach(rx => {
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 + rx * 25, HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + rx * 500, CANVAS_HEIGHT);
       ctx.stroke();
    });

    const all = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin' as const, color: '#fbbf24'}) )
    ].sort((a, b) => b.z - a.z);

    all.forEach(obj => {
      const scaleS = FOV / (FOV + obj.z);
      const scaleE = FOV / (FOV + (obj.z + (obj.length || 0)));
      const laneX = (obj.lane - 1) * 180;
      
      const xS = CANVAS_WIDTH / 2 + laneX * scaleS * 6.0;
      const xE = CANVAS_WIDTH / 2 + laneX * scaleE * 6.0;
      const yS = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleS;
      const yE = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleE;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const wS = 190 * scaleS; const wE = 190 * scaleE;
        const hS = TRAIN_HEIGHT * scaleS; const hE = TRAIN_HEIGHT * scaleE;

        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS - hS); ctx.lineTo(xE - wE/2, yE - hE);
        ctx.lineTo(xE + wE/2, yE - hE); ctx.lineTo(xS + wS/2, yS - hS);
        ctx.fill();
        
        if (obj.z > 35) {
           ctx.fillStyle = '#1e293b';
           ctx.beginPath();
           ctx.roundRect(xS - wS/2, yS - hS, wS, hS, 10 * scaleS);
           ctx.fill();
           
           ctx.fillStyle = 'rgba(255,255,255,0.1)';
           ctx.fillRect(xS - wS/2.5, yS - hS * 0.8, wS/1.5, hS * 0.4);
        }

        if (obj.type === 'ramp') {
           ctx.fillStyle = '#3b82f6';
           ctx.beginPath();
           ctx.moveTo(xS - wS/3, yS); ctx.lineTo(xS, yS - hS); ctx.lineTo(xS + wS/3, yS);
           ctx.fill();
        }
      } else if (obj.type === 'barrier') {
        const bW = 160 * scaleS; const bH = 90 * scaleS;
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(xS - bW/2, yS - bH, bW, bH);
        ctx.strokeStyle = 'white'; ctx.strokeRect(xS - bW/2, yS - bH, bW, bH);
      } else if (obj.type === 'coin') {
        const cs = 55 * scaleS;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 20; ctx.shadowColor = '#fbbf24';
        ctx.beginPath(); ctx.arc(xS, yS - 110 * scaleS, cs/2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    const pScale = FOV / (FOV + 115);
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
          <div className="text-6xl font-headline font-bold text-white italic tracking-tighter drop-shadow-2xl">
              {Math.floor(score / 10).toLocaleString()}<span className="text-xl text-primary ml-1">M</span>
          </div>
          <div className="flex items-center gap-3 bg-yellow-500 px-5 py-3 rounded-2xl shadow-2xl border-2 border-yellow-700">
             <span className="text-yellow-950 font-black text-3xl">{coins}</span>
             <div className="w-8 h-8 bg-yellow-700 rounded-full border-2 border-yellow-100 flex items-center justify-center">
                <span className="text-xs text-white font-bold">$</span>
             </div>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={700} className="w-full h-auto max-h-[98vh] shadow-2xl" />
      
      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-8xl font-headline font-bold text-white tracking-tighter italic mb-12 drop-shadow-2xl">BUSTED</h2>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-20 py-14 text-3xl font-bold bg-primary hover:scale-105 transition-transform shadow-2xl border-b-8 border-primary/50">
            TRY AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
