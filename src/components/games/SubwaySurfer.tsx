
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
  const HORIZON = CANVAS_HEIGHT * 0.45;
  const FOV = 135;
  const TRAIN_HEIGHT = 220; 

  const playerLane = useRef(1);
  const currentX = useRef(0);
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, length: number, type: 'train' | 'barrier' | 'ramp', color: string }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(4.5);
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
    gameSpeed.current = 4.5;
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
    setTimeout(() => isSliding.current = false, 750);
  };

  const update = useCallback(() => {
    if (gameOver) return;

    frameCount.current++;
    setScore(s => s + 1);

    const targetX = (playerLane.current - 1) * 150;
    currentX.current += (targetX - currentX.current) * 0.2;

    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.9;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if ((obs.type === 'train' || obs.type === 'ramp') && playerLane.current === obs.lane) {
        if (obs.z < 150 && (obs.z + obs.length) > 20) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 60) onTrain = true;
        }
      }
    });

    const floorY = onTrain ? TRAIN_HEIGHT : 0;
    if (playerYOffset.current <= floorY) {
      playerYOffset.current = floorY;
      jumpVelocity.current = 0;
      isJumping.current = false;
    }

    tunnelOffset.current = (tunnelOffset.current + gameSpeed.current * 12) % 600;

    if (frameCount.current % 110 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const isRamp = Math.random() > 0.65;
      obstacles.current.push({ 
        lane, 
        z: 7000, 
        length: isRamp ? 800 : 4000 + Math.random() * 2000, 
        type: isRamp ? 'ramp' : 'train',
        color: isRamp ? '#2563eb' : '#475569'
      });
    } else if (frameCount.current % 180 === 0) {
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 7000, length: 150, type: 'barrier', color: '#dc2626' });
    }

    if (frameCount.current % 45 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 7000 });

    gameSpeed.current += 0.0004;

    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 12;
      if (obj.lane === playerLane.current && obj.z < 120 && (obj.z + obj.length) > 30) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT - 30) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.4;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 70) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && !isSliding.current && playerYOffset.current < 80) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 12;
      if (c.lane === playerLane.current && c.z > 20 && c.z < 180) {
        if (Math.abs(playerYOffset.current - 0) < 120 || Math.abs(playerYOffset.current - TRAIN_HEIGHT) < 120) {
           setCoins(prev => prev + 1);
           c.z = -8000;
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => (o.z + o.length) > -1500);
    coinsList.current = coinsList.current.filter(c => c.z > -1500);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * 1.5, scale * 1.5); 

    const bodyH = isSliding.current ? 40 : 80;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 5, 20, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#f8fafc'; 
    ctx.beginPath(); ctx.roundRect(-14, -bodyH - 24, 28, bodyH, 10); ctx.fill();
    
    ctx.fillStyle = '#1e40af'; 
    ctx.fillRect(-11, -20, 9, 20);
    ctx.fillRect(2, -20, 9, 20);

    ctx.fillStyle = '#1e293b'; 
    ctx.beginPath(); ctx.roundRect(-10, -bodyH - 5, 20, 40, 5); ctx.fill();

    ctx.fillStyle = '#f8fafc'; 
    ctx.beginPath(); ctx.arc(0, -bodyH - 34, 14, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = '#ef4444'; 
    ctx.beginPath(); ctx.arc(0, -bodyH - 42, 8, 0, Math.PI, true); ctx.fill();

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.45, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let i = 0; i < 40; i++) {
      const z = (i * 240 - tunnelOffset.current + 8000) % 8000;
      const s = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * s;
      const tieW = 450 * s;
      
      ctx.fillStyle = '#18181b';
      ctx.fillRect(CANVAS_WIDTH/2 - tieW/2, y, tieW, 10 * s);
    }

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    [-1.2, -0.4, 0.4, 1.2].forEach(rx => {
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 + rx * 20, HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + rx * 500, CANVAS_HEIGHT);
       ctx.stroke();
    });

    const allObjects = [
      ...obstacles.current,
      ...coinsList.current.map(c => ({...c, length: 0, type: 'coin' as const, color: '#fbbf24'}) )
    ].sort((a, b) => b.z - a.z);

    allObjects.forEach(obj => {
      const scaleS = FOV / (FOV + obj.z);
      const laneX = (obj.lane - 1) * 180;
      const xS = CANVAS_WIDTH / 2 + laneX * scaleS * 6.5;
      const yS = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleS;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const scaleE = FOV / (FOV + (obj.z + obj.length!));
        const xE = CANVAS_WIDTH / 2 + laneX * scaleE * 6.5;
        const yE = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleE;
        
        const wS = 200 * scaleS; const wE = 200 * scaleE;
        const hS = TRAIN_HEIGHT * scaleS; const hE = TRAIN_HEIGHT * scaleE;

        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS - hS); ctx.lineTo(xE - wE/2, yE - hE);
        ctx.lineTo(xE + wE/2, yE - hE); ctx.lineTo(xS + wS/2, yS - hS);
        ctx.fill();
        
        if (obj.z > 30) {
           ctx.fillStyle = '#334155';
           ctx.beginPath();
           ctx.roundRect(xS - wS/2, yS - hS, wS, hS, 10 * scaleS);
           ctx.fill();
           
           ctx.fillStyle = 'rgba(254,240,138,0.15)';
           ctx.fillRect(xS - wS/2.5, yS - hS * 0.8, wS/1.5, hS * 0.4);
        }
      } else if (obj.type === 'barrier') {
        const bW = 160 * scaleS; const bH = 80 * scaleS;
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(xS - bW/2, yS - bH, bW, bH);
      } else if (obj.type === 'coin') {
        const cs = 50 * scaleS;
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(xS, yS - 120 * scaleS, cs/2, 0, Math.PI * 2); ctx.fill();
      }
    });

    const pScale = FOV / (FOV + 130);
    const px = CANVAS_WIDTH / 2 + currentX.current * pScale * 2.8;
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * pScale) - playerYOffset.current * pScale;
    drawCharacter(ctx, px, py, pScale);

  }, [score, coins, tunnelOffset.current]);

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

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10) + coins * 100); }, [gameOver, score, coins, onGameOver]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden touch-none select-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="absolute top-10 inset-x-10 flex justify-between items-start z-20 pointer-events-none">
          <div className="flex flex-col">
              <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Score</span>
              <div className="text-6xl font-headline font-bold text-white italic tracking-tighter">
                  {Math.floor(score / 10).toLocaleString()}
              </div>
          </div>
          <div className="bg-yellow-400/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
             <span className="text-yellow-950 font-black text-3xl">{coins}</span>
             <div className="w-8 h-8 bg-yellow-600 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-white font-black text-xs">$</span>
             </div>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={700} className="w-full h-auto max-h-[98vh] shadow-2xl" />
      
      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-8xl font-headline font-bold text-white italic mb-10">BUSTED</h2>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-20 py-14 text-3xl font-black bg-primary text-white italic border-b-8 border-primary/40">
            TRY AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
