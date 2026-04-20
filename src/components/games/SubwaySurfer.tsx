
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';

export default function SubwaySurfer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 600;
  const HORIZON = CANVAS_HEIGHT * 0.42;
  const FOV = 100;
  const TRAIN_HEIGHT = 55;

  const playerLane = useRef(1); // 0, 1, 2
  const currentX = useRef(0); // Interpolated X for smoothness
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, length: number, type: 'train' | 'barrier' | 'ramp', color: string }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(3.5);
  const roadOffset = useRef(0);
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
    roadOffset.current = 0;
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
    jumpVelocity.current = 15;
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
    roadOffset.current = (roadOffset.current + gameSpeed.current * 7) % 100;

    // Fluid X-Axis Lerp
    const targetX = (playerLane.current - 1) * 115;
    currentX.current += (targetX - currentX.current) * 0.25;

    // Physics
    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.85;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if (obs.type === 'train' || obs.type === 'ramp') {
        const trainStart = obs.z;
        const trainEnd = obs.z + obs.length;
        if (playerLane.current === obs.lane && trainStart < 55 && trainEnd > 20) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 8) {
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

    // Spawn Logic
    if (frameCount.current % 90 === 0) {
      const rand = Math.random();
      if (rand > 0.4) {
        const type = Math.random() > 0.6 ? 'ramp' : 'train';
        obstacles.current.push({ 
          lane: Math.floor(Math.random() * 3), 
          z: 800, 
          length: 400 + Math.random() * 400, 
          type: type,
          color: ['#1e40af', '#1e3a8a', '#334155'][Math.floor(Math.random() * 3)]
        });
      } else {
        obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 800, length: 30, type: 'barrier', color: '#dc2626' });
      }
    }
    if (frameCount.current % 35 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 800 });

    gameSpeed.current += 0.0008;

    // Collisions
    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 7;
      if (obj.lane === playerLane.current && obj.z < 45 && obj.z + obj.length > 25) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.3;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 15) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && playerYOffset.current < 25) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 7;
      if (c.lane === playerLane.current && c.z > 20 && c.z < 50) {
        const charY = playerYOffset.current;
        if (Math.abs(charY - 0) < 40 || Math.abs(charY - TRAIN_HEIGHT) < 40) {
           setCoins(prev => prev + 1);
           c.z = -200;
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => o.z + o.length > -100);
    coinsList.current = coinsList.current.filter(c => c.z > -100);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bodyH = isSliding.current ? 25 : 55;

    // Character Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Humanoid Body
    ctx.fillStyle = '#C41DFA';
    ctx.beginPath(); ctx.roundRect(-16, -bodyH - 15, 32, bodyH, 12); ctx.fill();
    
    // Shirt / Detail
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-16, -bodyH - 5, 32, 10);

    // Head
    ctx.fillStyle = '#ffccaa';
    ctx.beginPath(); ctx.arc(0, -bodyH - 35, 14, 0, Math.PI * 2); ctx.fill();
    
    // Stylish Cap
    ctx.fillStyle = '#FA1D64';
    ctx.beginPath(); ctx.roundRect(-14, -bodyH - 49, 28, 10, 4); ctx.fill();
    ctx.fillRect(0, -bodyH - 49, 22, 4);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Neon Sky
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Glowing Horizon
    ctx.shadowBlur = 40; ctx.shadowColor = '#4f46e5';
    ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(CANVAS_WIDTH, HORIZON); ctx.stroke();
    ctx.shadowBlur = 0;

    // Concrete Floor
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Moving Tracks
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 3; i++) {
      const laneX = (i - 1.5) * 115;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
      ctx.lineTo(CANVAS_WIDTH/2 + laneX * 15, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Sort and Draw objects by depth
    const allObjects = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin', color: '#FAC11D'}))
    ].sort((a, b) => b.z - a.z);

    allObjects.forEach(obj => {
      const scaleStart = FOV / (FOV + obj.z);
      const scaleEnd = FOV / (FOV + obj.z + obj.length);
      const laneX = (obj.lane - 1) * 115;
      
      const xStart = CANVAS_WIDTH / 2 + laneX * scaleStart;
      const xEnd = CANVAS_WIDTH / 2 + laneX * scaleEnd;
      const yStart = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleStart;
      const yEnd = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleEnd;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const wStart = 105 * scaleStart;
        const wEnd = 105 * scaleEnd;
        const hStart = TRAIN_HEIGHT * scaleStart;
        const hEnd = TRAIN_HEIGHT * scaleEnd;

        // Train Body - Metallic Blue
        const grad = ctx.createLinearGradient(xStart, yStart, xStart, yStart - hStart);
        grad.addColorStop(0, '#1e3a8a'); grad.addColorStop(1, '#3b82f6');
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.moveTo(xStart - wStart/2, yStart);
        ctx.lineTo(xEnd - wEnd/2, yEnd);
        ctx.lineTo(xEnd + wEnd/2, yEnd);
        ctx.lineTo(xStart + wStart/2, yStart);
        ctx.fill();
        
        // Roof
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.moveTo(xStart - wStart/2, yStart - hStart);
        ctx.lineTo(xEnd - wEnd/2, yEnd - hEnd);
        ctx.lineTo(xEnd + wEnd/2, yEnd - hEnd);
        ctx.lineTo(xStart + wStart/2, yStart - hStart);
        ctx.fill();

        // Windows
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(xStart - wStart/2.5, yStart - hStart * 0.8, wStart * 0.8, hStart * 0.4);
      } else if (obj.type === 'barrier') {
        const bW = 85 * scaleStart;
        const bH = 45 * scaleStart;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(xStart - bW/2, yStart - bH, bW, bH);
        ctx.fillStyle = 'white';
        ctx.fillRect(xStart - bW/2, yStart - bH/2 - 2, bW, 4);
      } else if (obj.type === 'coin') {
        const cS = 35 * scaleStart;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 10; ctx.shadowColor = 'yellow';
        ctx.beginPath(); ctx.arc(xStart, yStart - 25 * scaleStart, cS/2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Player character with fluid position
    const pScale = FOV / (FOV + 40);
    const px = CANVAS_WIDTH / 2 + currentX.current * pScale;
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * pScale) - playerYOffset.current * pScale;
    drawCharacter(ctx, px, py, pScale * 1.6);

    // Speed Lines Effect
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(0, CANVAS_HEIGHT - 40); ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 40); ctx.stroke();
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

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10) + coins * 10); }, [gameOver, score, coins, onGameOver]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden touch-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="absolute top-10 right-10 flex flex-col items-end gap-2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-2xl border border-yellow-500/30">
             <span className="text-yellow-500 font-black text-2xl">{coins}</span>
             <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-[0_0_10px_yellow]" />
          </div>
          <div className="text-4xl font-headline font-bold text-white italic tracking-tighter">
             {Math.floor(score / 10)}<span className="text-sm font-normal text-muted-foreground ml-1">M</span>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[85vh] shadow-[0_0_150px_rgba(79,70,229,0.15)]" />
      
      {isMobile && !gameOver && (
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-6 px-10">
          <div className="flex w-full justify-between items-center gap-4">
             <Button variant="outline" className="w-20 h-20 rounded-[2.5rem] bg-white/5 border-white/10" onClick={() => moveLane(-1)}><ArrowLeft className="h-10 w-10 text-white" /></Button>
             <div className="flex flex-col gap-4">
                <Button className="w-24 h-24 rounded-[3rem] bg-primary shadow-xl shadow-primary/20" onClick={jump}><ArrowUp className="h-12 w-12" /></Button>
                <Button className="w-24 h-20 rounded-[2rem] bg-secondary" onClick={slide}><ArrowDown className="h-10 w-10" /></Button>
             </div>
             <Button variant="outline" className="w-20 h-20 rounded-[2.5rem] bg-white/5 border-white/10" onClick={() => moveLane(1)}><ArrowRight className="h-10 w-10 text-white" /></Button>
          </div>
          <p className="text-[0.6rem] uppercase tracking-[0.5em] text-white/20 font-bold">Swipe or use buttons</p>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-[#020617]/98 flex flex-col items-center justify-center p-8 text-center z-30 backdrop-blur-xl">
          <div className="relative mb-10">
             <h2 className="text-9xl font-headline font-bold text-white tracking-tighter italic z-10 relative">BUSTED</h2>
             <div className="absolute inset-0 bg-primary blur-[80px] opacity-20 -z-0" />
          </div>
          <div className="grid grid-cols-2 gap-8 mb-16 w-full max-w-sm">
             <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Distance</p>
                <p className="text-3xl font-bold">{Math.floor(score / 10)}M</p>
             </div>
             <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Coins</p>
                <p className="text-3xl font-bold text-yellow-500">{coins}</p>
             </div>
          </div>
          <Button onClick={initGame} size="lg" className="rounded-[2rem] px-20 py-12 text-3xl font-bold bg-primary hover:bg-primary/90 transition-all hover:scale-110 shadow-2xl shadow-primary/30">
            RUN AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
