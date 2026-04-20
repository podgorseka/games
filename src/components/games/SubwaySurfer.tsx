
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
  const HORIZON = CANVAS_HEIGHT * 0.42;
  const FOV = 130;
  const TRAIN_HEIGHT = 80;

  const playerLane = useRef(1);
  const currentX = useRef(0);
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, length: number, type: 'train' | 'barrier' | 'ramp', climbable: boolean, color: string }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(3.5);
  const frameCount = useRef(0);

  const initGame = useCallback(() => {
    playerLane.current = 1;
    currentX.current = 0;
    playerYOffset.current = 0;
    isJumping.current = false;
    isSliding.current = false;
    obstacles.current = [];
    coinsList.current = [];
    gameSpeed.current = 3.5;
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

    const targetX = (playerLane.current - 1) * 130;
    currentX.current += (targetX - currentX.current) * 0.15;

    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.8;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if (obs.type === 'train' || obs.type === 'ramp') {
        if (playerLane.current === obs.lane && obs.z < 60 && (obs.z + obs.length) > 20) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 15) {
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

    if (frameCount.current % 100 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const isClimbable = Math.random() > 0.6;
      obstacles.current.push({ 
        lane, 
        z: 1600, 
        length: isClimbable ? 400 : 800 + Math.random() * 1000, 
        type: isClimbable ? 'ramp' : 'train',
        climbable: isClimbable,
        color: isClimbable ? '#2563eb' : '#1e293b'
      });
    } else if (frameCount.current % 140 === 0) {
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 1600, length: 50, type: 'barrier', climbable: false, color: '#dc2626' });
    }

    if (frameCount.current % 50 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 1600 });

    gameSpeed.current += 0.0006;

    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 7;
      if (obj.lane === playerLane.current && obj.z < 50 && (obj.z + obj.length) > 30) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.25;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 30) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && !isSliding.current && playerYOffset.current < 50) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 7;
      if (c.lane === playerLane.current && c.z > 25 && c.z < 75) {
        if (Math.abs(playerYOffset.current - 0) < 60 || Math.abs(playerYOffset.current - TRAIN_HEIGHT) < 60) {
           setCoins(prev => prev + 1);
           c.z = -2000;
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => (o.z + o.length) > -200);
    coinsList.current = coinsList.current.filter(c => c.z > -200);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bodyH = isSliding.current ? 40 : 70;
    
    // Character Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 0, 35, 15, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = '#C41DFA';
    ctx.beginPath(); ctx.roundRect(-25, -bodyH - 30, 50, bodyH, 20); ctx.fill();
    
    // Head
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(0, -bodyH - 50, 20, 0, Math.PI * 2); ctx.fill();
    
    // Cap
    ctx.fillStyle = '#FA1D64';
    ctx.beginPath(); ctx.roundRect(-22, -bodyH - 68, 44, 15, 8); ctx.fill();
    ctx.fillRect(10, -bodyH - 68, 30, 8);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Deep Atmospheric Background
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617'); sky.addColorStop(0.7, '#1e1b4b'); sky.addColorStop(1, '#312e81');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Realistic Ground
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Dynamic Rails
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
    for (let i = 0; i <= 3; i++) {
      const laneX = (i - 1.5) * 150;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
      ctx.lineTo(CANVAS_WIDTH/2 + laneX * 16, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Sort objects by depth
    const all = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin', color: '#FAC11D', climbable: false}))
    ].sort((a, b) => b.z - a.z);

    all.forEach(obj => {
      const scaleS = FOV / (FOV + obj.z);
      const scaleE = FOV / (FOV + obj.z + obj.length);
      const laneX = (obj.lane - 1) * 150;
      
      const xS = CANVAS_WIDTH / 2 + laneX * scaleS * 4.2;
      const xE = CANVAS_WIDTH / 2 + laneX * scaleE * 4.2;
      const yS = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleS;
      const yE = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleE;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const wS = 140 * scaleS; const wE = 140 * scaleE;
        const hS = TRAIN_HEIGHT * scaleS; const hE = TRAIN_HEIGHT * scaleE;

        // Realistic Train Body
        const grad = ctx.createLinearGradient(xS, yS, xS, yS - hS);
        grad.addColorStop(0, obj.color);
        grad.addColorStop(1, obj.climbable ? '#444' : '#222');
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS); ctx.lineTo(xE - wE/2, yE);
        ctx.lineTo(xE + wE/2, yE); ctx.lineTo(xS + wS/2, yS);
        ctx.fill();
        
        // Roof
        ctx.fillStyle = obj.climbable ? '#2563eb' : '#0f172a';
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS - hS); ctx.lineTo(xE - wE/2, yE - hE);
        ctx.lineTo(xE + wE/2, yE - hE); ctx.lineTo(xS + wS/2, yS - hS);
        ctx.fill();

        if (obj.type === 'ramp') {
           ctx.fillStyle = 'rgba(255,255,255,0.3)';
           ctx.beginPath();
           ctx.moveTo(xS - wS/3, yS); ctx.lineTo(xS, yS - hS); ctx.lineTo(xS + wS/3, yS);
           ctx.fill();
        }

        // Windows
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for(let i=1; i<5; i++) {
           const winZ = obj.z + (obj.length / 5) * i;
           const winScale = FOV / (FOV + winZ);
           const winX = CANVAS_WIDTH / 2 + laneX * winScale * 4.2;
           const winY = HORIZON + (CANVAS_HEIGHT - HORIZON) * winScale;
           ctx.fillRect(winX - (wS/4), winY - (hS*0.7), wS/2, hS/3);
        }
      } else if (obj.type === 'barrier') {
        const bW = 120 * scaleS; const bH = 60 * scaleS;
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(xS - bW/2, yS - bH, bW, bH);
        ctx.fillStyle = 'white';
        ctx.fillRect(xS - bW/2, yS - (bH*0.7), bW, 5 * scaleS);
      } else if (obj.type === 'coin') {
        const cs = 40 * scaleS;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 10; ctx.shadowColor = '#fbbf24';
        ctx.beginPath(); ctx.arc(xS, yS - 50 * scaleS, cs/2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Character Rendering
    const pScale = FOV / (FOV + 60);
    const px = CANVAS_WIDTH / 2 + currentX.current * pScale * 1.6;
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * pScale) - playerYOffset.current * pScale;
    drawCharacter(ctx, px, py, pScale * 2.2);

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
      if (dx > 30) moveLane(1);
      else if (dx < -30) moveLane(-1);
    } else {
      if (dy < -30) jump();
      else if (dy > 30) slide();
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
      <div className="absolute top-12 left-12 flex flex-col items-start gap-2 z-20 pointer-events-none">
          <div className="text-7xl font-headline font-bold text-white italic tracking-tighter drop-shadow-2xl">
             {Math.floor(score / 10)}<span className="text-2xl text-primary ml-1 uppercase">M</span>
          </div>
          <div className="flex items-center gap-3 bg-yellow-500/30 px-5 py-2 rounded-full border border-yellow-500/50 backdrop-blur-xl">
             <span className="text-yellow-400 font-bold text-xl">{coins} COINS</span>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[96vh] shadow-2xl" />
      
      {!gameOver && (
        <div className="absolute bottom-20 text-white/20 text-xs font-bold uppercase tracking-[0.6em] animate-pulse">
           Swipe to Run
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-10 text-center z-30 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-white tracking-tighter italic mb-12">STOPPED</h2>
          <div className="flex gap-8 mb-24">
             <div className="bg-white/5 px-12 py-10 rounded-3xl border border-white/10">
                <p className="text-5xl font-bold">{Math.floor(score / 10)}M</p>
                <p className="text-xs uppercase text-white/30 mt-3 tracking-widest">Distance</p>
             </div>
             <div className="bg-white/5 px-12 py-10 rounded-3xl border border-white/10">
                <p className="text-5xl font-bold text-yellow-500">{coins}</p>
                <p className="text-xs uppercase text-white/30 mt-3 tracking-widest">Collected</p>
             </div>
          </div>
          <Button onClick={initGame} size="lg" className="rounded-full px-24 py-16 text-4xl font-bold bg-primary hover:bg-primary/90 transition-all hover:scale-110 shadow-2xl shadow-primary/50">
            PLAY AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
