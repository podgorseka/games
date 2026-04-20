
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Zap } from 'lucide-react';

export default function SubwaySurfer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 600;
  const HORIZON = CANVAS_HEIGHT * 0.4;
  const FOV = 110;
  const TRAIN_HEIGHT = 90;

  const playerLane = useRef(1);
  const currentX = useRef(0);
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, length: number, type: 'train' | 'barrier' | 'ramp', climbable: boolean, color: string }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(4);
  const frameCount = useRef(0);

  const initGame = useCallback(() => {
    playerLane.current = 1;
    currentX.current = 0;
    playerYOffset.current = 0;
    isJumping.current = false;
    isSliding.current = false;
    obstacles.current = [];
    coinsList.current = [];
    gameSpeed.current = 4;
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
    jumpVelocity.current = 18;
    isSliding.current = false;
  };

  const slide = () => {
    if (gameOver || isSliding.current) return;
    isSliding.current = true;
    setTimeout(() => isSliding.current = false, 800);
  };

  const update = useCallback(() => {
    if (gameOver) return;

    frameCount.current++;
    setScore(s => s + 1);

    const targetX = (playerLane.current - 1) * 140;
    currentX.current += (targetX - currentX.current) * 0.18;

    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.85;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if (obs.type === 'train' || obs.type === 'ramp') {
        if (playerLane.current === obs.lane && obs.z < 80 && (obs.z + obs.length) > 20) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 20) {
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

    if (frameCount.current % 120 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const isClimbable = Math.random() > 0.65;
      obstacles.current.push({ 
        lane, 
        z: 2500, 
        length: isClimbable ? 500 : 1200 + Math.random() * 1500, 
        type: isClimbable ? 'ramp' : 'train',
        climbable: isClimbable,
        color: isClimbable ? '#2563eb' : '#1e1b4b'
      });
    } else if (frameCount.current % 160 === 0) {
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 2500, length: 60, type: 'barrier', climbable: false, color: '#dc2626' });
    }

    if (frameCount.current % 60 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 2500 });

    gameSpeed.current += 0.0008;

    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 8;
      if (obj.lane === playerLane.current && obj.z < 60 && (obj.z + obj.length) > 30) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.3;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 35) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && !isSliding.current && playerYOffset.current < 60) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 8;
      if (c.lane === playerLane.current && c.z > 30 && c.z < 90) {
        if (Math.abs(playerYOffset.current - 0) < 70 || Math.abs(playerYOffset.current - TRAIN_HEIGHT) < 70) {
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

    const bodyH = isSliding.current ? 45 : 80;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 18, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = '#C41DFA';
    ctx.beginPath(); ctx.roundRect(-30, -bodyH - 35, 60, bodyH, 25); ctx.fill();
    
    // Head
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(0, -bodyH - 55, 22, 0, Math.PI * 2); ctx.fill();
    
    // Fashion Detail
    ctx.fillStyle = '#FA1D64';
    ctx.beginPath(); ctx.roundRect(-25, -bodyH - 75, 50, 18, 10); ctx.fill();
    ctx.fillRect(15, -bodyH - 75, 35, 10);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Atmospheric Depth
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#000000'); sky.addColorStop(0.8, '#0f172a'); sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Track Ground
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Realistic Lane Markers
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
    for (let i = 0; i <= 3; i++) {
      const laneX = (i - 1.5) * 160;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
      ctx.lineTo(CANVAS_WIDTH/2 + laneX * 20, CANVAS_HEIGHT);
      ctx.stroke();
    }

    const all = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin', color: '#FAC11D', climbable: false}))
    ].sort((a, b) => b.z - a.z);

    all.forEach(obj => {
      const scaleS = FOV / (FOV + obj.z);
      const scaleE = FOV / (FOV + obj.z + obj.length);
      const laneX = (obj.lane - 1) * 160;
      
      const xS = CANVAS_WIDTH / 2 + laneX * scaleS * 4.5;
      const xE = CANVAS_WIDTH / 2 + laneX * scaleE * 4.5;
      const yS = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleS;
      const yE = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleE;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const wS = 150 * scaleS; const wE = 150 * scaleE;
        const hS = TRAIN_HEIGHT * scaleS; const hE = TRAIN_HEIGHT * scaleE;

        // Realistic Metal Body with Shading
        const bodyGrad = ctx.createLinearGradient(xS, yS, xS, yS - hS);
        bodyGrad.addColorStop(0, '#000000');
        bodyGrad.addColorStop(1, obj.color);
        ctx.fillStyle = bodyGrad;
        
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS); ctx.lineTo(xE - wE/2, yE);
        ctx.lineTo(xE + wE/2, yE); ctx.lineTo(xS + wS/2, yS);
        ctx.fill();
        
        // Train Roof with Perspective
        ctx.fillStyle = obj.climbable ? '#1d4ed8' : '#0f172a';
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS - hS); ctx.lineTo(xE - wE/2, yE - hE);
        ctx.lineTo(xE + wE/2, yE - hE); ctx.lineTo(xS + wS/2, yS - hS);
        ctx.fill();

        // Front Face of the Train (Only if approaching)
        if (obj.z > 0 && obj.z < 2000) {
           ctx.fillStyle = '#000';
           ctx.fillRect(xS - wS/2, yS - hS, wS, hS);
           // Front Windows
           ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
           ctx.fillRect(xS - wS/2.5, yS - hS * 0.8, wS * 0.8, hS * 0.4);
        }

        if (obj.type === 'ramp') {
           ctx.fillStyle = 'rgba(255,255,255,0.4)';
           ctx.beginPath();
           ctx.moveTo(xS - wS/3, yS); ctx.lineTo(xS, yS - hS); ctx.lineTo(xS + wS/3, yS);
           ctx.fill();
        }
      } else if (obj.type === 'barrier') {
        const bW = 130 * scaleS; const bH = 70 * scaleS;
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(xS - bW/2, yS - bH, bW, bH);
        ctx.fillStyle = 'white';
        ctx.fillRect(xS - bW/2, yS - (bH*0.75), bW, 8 * scaleS);
      } else if (obj.type === 'coin') {
        const cs = 50 * scaleS;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 15; ctx.shadowColor = '#fbbf24';
        ctx.beginPath(); ctx.arc(xS, yS - 60 * scaleS, cs/2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Character with Z-Depth
    const pScale = FOV / (FOV + 80);
    const px = CANVAS_WIDTH / 2 + currentX.current * pScale * 1.8;
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * pScale) - playerYOffset.current * pScale;
    drawCharacter(ctx, px, py, pScale * 2.5);

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
      if (dx > 40) moveLane(1);
      else if (dx < -40) moveLane(-1);
    } else {
      if (dy < -40) jump();
      else if (dy > 40) slide();
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

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10) + coins * 15); }, [gameOver, score, coins, onGameOver]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden touch-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="absolute top-12 left-12 flex flex-col items-start gap-2 z-20 pointer-events-none">
          <div className="text-8xl font-headline font-bold text-white italic tracking-tighter drop-shadow-2xl">
             {Math.floor(score / 10)}<span className="text-2xl text-primary ml-1 uppercase">M</span>
          </div>
          <div className="flex items-center gap-3 bg-yellow-500/30 px-6 py-2 rounded-full border border-yellow-500/50 backdrop-blur-xl">
             <span className="text-yellow-400 font-bold text-2xl">{coins} COINS</span>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[98vh] shadow-2xl" />
      
      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-30 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-white tracking-tighter italic mb-12">BUSTED</h2>
          <div className="flex gap-10 mb-24">
             <div className="bg-white/5 px-14 py-12 rounded-3xl border border-white/10">
                <p className="text-6xl font-bold">{Math.floor(score / 10)}M</p>
                <p className="text-sm uppercase text-white/40 mt-3 tracking-widest">Run</p>
             </div>
             <div className="bg-white/5 px-14 py-12 rounded-3xl border border-white/10">
                <p className="text-6xl font-bold text-yellow-500">{coins}</p>
                <p className="text-sm uppercase text-white/40 mt-3 tracking-widest">Bank</p>
             </div>
          </div>
          <Button onClick={initGame} size="lg" className="rounded-3xl px-24 py-16 text-5xl font-bold bg-primary hover:scale-110 transition-transform shadow-2xl shadow-primary/50">
            RUN AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
