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
  const HORIZON = CANVAS_HEIGHT * 0.38;
  const FOV = 120;
  const TRAIN_HEIGHT = 240;

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
    jumpVelocity.current = 22;
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
    currentX.current += (targetX - currentX.current) * 0.22;

    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.95;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if (obs.type === 'train' || obs.type === 'ramp') {
        if (playerLane.current === obs.lane && obs.z < 120 && (obs.z + obs.length) > 30) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 45) {
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

    tunnelOffset.current = (tunnelOffset.current + gameSpeed.current * 10) % 400;

    if (frameCount.current % 140 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const isClimbable = Math.random() > 0.6;
      obstacles.current.push({ 
        lane, 
        z: 4000, 
        length: isClimbable ? 800 : 2800 + Math.random() * 1000, 
        type: isClimbable ? 'ramp' : 'train',
        color: isClimbable ? '#E86B19' : '#C15B28'
      });
    } else if (frameCount.current % 180 === 0) {
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 4000, length: 150, type: 'barrier', color: '#ef4444' });
    }

    if (frameCount.current % 80 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 4000 });

    gameSpeed.current += 0.0005;

    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 8;
      if (obj.lane === playerLane.current && obj.z < 110 && (obj.z + obj.length) > 35) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.45;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 60) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && !isSliding.current && playerYOffset.current < 80) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 8;
      if (c.lane === playerLane.current && c.z > 15 && c.z < 140) {
        if (Math.abs(playerYOffset.current - 0) < 130 || Math.abs(playerYOffset.current - TRAIN_HEIGHT) < 130) {
           setCoins(prev => prev + 1);
           c.z = -6000;
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => (o.z + o.length) > -600);
    coinsList.current = coinsList.current.filter(c => c.z > -600);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * 3.2, scale * 3.2);

    const bodyH = isSliding.current ? 40 : 80;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 5, 30, 10, 0, 0, Math.PI * 2); ctx.fill();

    // Legs
    ctx.fillStyle = '#4A6FA5'; // Blue Jeans
    ctx.fillRect(-15, -30, 12, 30);
    ctx.fillRect(3, -30, 12, 30);

    // Hoodie (White/Grey)
    ctx.fillStyle = '#E5E7EB';
    ctx.beginPath(); ctx.roundRect(-20, -bodyH - 20, 40, bodyH, 15); ctx.fill();
    
    // Backpack (Blue with logo)
    ctx.fillStyle = '#1E3A8A';
    ctx.beginPath(); ctx.roundRect(-15, -bodyH - 5, 30, 50, 8); ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SURF", 0, -bodyH + 25);

    // Head / Hoodie Hood
    ctx.fillStyle = '#D1D5DB';
    ctx.beginPath(); ctx.arc(0, -bodyH - 35, 20, 0, Math.PI * 2); ctx.fill();
    
    // Red Cap (Back view)
    ctx.fillStyle = '#DC2626';
    ctx.beginPath(); ctx.arc(0, -bodyH - 45, 12, 0, Math.PI, true); ctx.fill();

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Deep Tunnel Gradient
    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.38, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Tunnel Walls & Lights
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const z = (i * 500 - tunnelOffset.current * 1.5 + 4000) % 4000;
      const s = FOV / (FOV + z);
      const xLeft = CANVAS_WIDTH/2 - 400 * s;
      const xRight = CANVAS_WIDTH/2 + 400 * s;
      const yTop = HORIZON - 300 * s;
      const yBot = CANVAS_HEIGHT;

      // Wall Lights
      ctx.fillStyle = '#FACC15';
      ctx.shadowBlur = 15; ctx.shadowColor = '#FACC15';
      ctx.fillRect(xLeft, yTop + 200 * s, 15 * s, 10 * s);
      ctx.fillRect(xRight - 15 * s, yTop + 200 * s, 15 * s, 10 * s);
      ctx.shadowBlur = 0;
    }

    // Rails & Wooden Ties
    for (let i = 0; i < 25; i++) {
      const z = (i * 200 - tunnelOffset.current + 4000) % 4000;
      const s = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * s;
      const tieW = 350 * s;
      const tieH = 15 * s;
      
      // Ties
      ctx.fillStyle = '#422006';
      ctx.fillRect(CANVAS_WIDTH/2 - tieW/2, y, tieW, tieH);
    }

    // Steel Rails
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    [-1.2, -0.4, 0.4, 1.2].forEach(rx => {
       ctx.beginPath();
       ctx.moveTo(CANVAS_WIDTH/2 + (rx * 40 * (FOV/FOV)), HORIZON);
       ctx.lineTo(CANVAS_WIDTH/2 + (rx * 380), CANVAS_HEIGHT);
       ctx.stroke();
    });

    const all = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin' as const, color: '#FACC15'}) )
    ].sort((a, b) => b.z - a.z);

    all.forEach(obj => {
      const scaleS = FOV / (FOV + obj.z);
      const scaleE = FOV / (FOV + (obj.z + (obj.length || 0)));
      const laneX = (obj.lane - 1) * 165;
      
      const xS = CANVAS_WIDTH / 2 + laneX * scaleS * 5.6;
      const xE = CANVAS_WIDTH / 2 + laneX * scaleE * 5.6;
      const yS = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleS;
      const yE = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleE;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const wS = 160 * scaleS; const wE = 160 * scaleE;
        const hS = TRAIN_HEIGHT * scaleS; const hE = TRAIN_HEIGHT * scaleE;

        // Container Texture / Ribs
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS - hS); ctx.lineTo(xE - wE/2, yE - hE);
        ctx.lineTo(xE + wE/2, yE - hE); ctx.lineTo(xS + wS/2, yS - hS);
        ctx.fill();
        
        // Front Face
        if (obj.z > 50) {
           ctx.fillStyle = '#1e293b';
           ctx.fillRect(xS - wS/2, yS - hS, wS, hS);
           ctx.strokeStyle = 'rgba(255,255,255,0.2)';
           ctx.strokeRect(xS - wS/2, yS - hS, wS, hS);
           
           // Windshield
           ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
           ctx.fillRect(xS - wS/2.2, yS - hS * 0.85, wS * 0.9, hS * 0.35);
        }

        // Side Ribs
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        for(let r=0; r<10; r++) {
           const rZ = obj.z + (obj.length / 10) * r;
           const rs = FOV / (FOV + rZ);
           const rx = CANVAS_WIDTH/2 + laneX * rs * 5.6;
           const ry = HORIZON + (CANVAS_HEIGHT - HORIZON) * rs;
           const rw = 160 * rs;
           const rh = TRAIN_HEIGHT * rs;
           ctx.beginPath(); ctx.moveTo(rx - rw/2, ry); ctx.lineTo(rx - rw/2, ry - rh); ctx.stroke();
        }

        if (obj.type === 'ramp') {
           ctx.fillStyle = '#FACC15';
           ctx.beginPath();
           ctx.moveTo(xS - wS/3, yS); ctx.lineTo(xS, yS - hS); ctx.lineTo(xS + wS/3, yS);
           ctx.fill();
        }
      } else if (obj.type === 'barrier') {
        const bW = 145 * scaleS; const bH = 85 * scaleS;
        ctx.fillStyle = '#F87171';
        ctx.fillRect(xS - bW/2, yS - bH, bW, bH);
        ctx.fillStyle = '#FFF';
        ctx.fillRect(xS - bW/2, yS - bH * 0.7, bW, 12 * scaleS);
      } else if (obj.type === 'coin') {
        const cs = 50 * scaleS;
        ctx.fillStyle = '#FACC15';
        ctx.shadowBlur = 10; ctx.shadowColor = '#FACC15';
        ctx.beginPath(); ctx.arc(xS, yS - 90 * scaleS, cs/2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#D97706'; ctx.stroke();
      }
    });

    const pScale = FOV / (FOV + 100);
    const px = CANVAS_WIDTH / 2 + currentX.current * pScale * 2.3;
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

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10) + coins * 20); }, [gameOver, score, coins, onGameOver]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden touch-none select-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Game UI Overlay */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-20 pointer-events-none">
          <div className="flex flex-col gap-1">
             <div className="text-5xl font-headline font-bold text-white italic tracking-tighter drop-shadow-lg">
                {Math.floor(score / 10).toLocaleString()}<span className="text-xl text-primary ml-1">M</span>
             </div>
             <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-400 font-bold text-sm tracking-wider uppercase">High Score: 3,823</span>
             </div>
          </div>
          <div className="flex flex-col items-end gap-2">
             <div className="flex items-center gap-3 bg-yellow-400 px-4 py-2 rounded-xl shadow-xl border-2 border-yellow-600">
                <span className="text-yellow-900 font-black text-2xl">{coins}</span>
                <div className="w-6 h-6 bg-yellow-600 rounded-full border-2 border-yellow-200 flex items-center justify-center">
                   <span className="text-[10px] text-white font-bold">$</span>
                </div>
             </div>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={700} className="w-full h-auto max-h-[98vh] shadow-2xl" />
      
      {!gameOver && (
        <div className="absolute bottom-12 text-white/20 font-bold uppercase tracking-[0.5em] text-xs animate-pulse">
           Swipe to Surf
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-white tracking-tighter italic mb-12 drop-shadow-2xl">CAUGHT!</h2>
          <div className="flex gap-10 mb-24">
             <div className="bg-white/5 px-10 py-8 rounded-3xl border border-white/10 shadow-inner">
                <p className="text-5xl font-bold">{Math.floor(score / 10)}M</p>
                <p className="text-xs uppercase text-white/30 mt-3 tracking-widest font-bold">Distance</p>
             </div>
             <div className="bg-white/5 px-10 py-8 rounded-3xl border border-white/10 shadow-inner">
                <p className="text-5xl font-bold text-yellow-500">{coins}</p>
                <p className="text-xs uppercase text-white/30 mt-3 tracking-widest font-bold">Loot</p>
             </div>
          </div>
          <Button onClick={initGame} size="lg" className="rounded-3xl px-24 py-16 text-4xl font-bold bg-primary hover:scale-110 transition-transform shadow-2xl border-b-8 border-primary/50">
            RUN AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
