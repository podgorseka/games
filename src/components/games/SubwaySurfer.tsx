
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
  const HORIZON = CANVAS_HEIGHT * 0.4;
  const FOV = 100;
  const TRAIN_HEIGHT = 50;

  const playerLane = useRef(1); // 0, 1, 2
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, length: number, type: 'train' | 'barrier' | 'ramp', color: string }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(3.0);
  const roadOffset = useRef(0);
  const frameCount = useRef(0);

  const initGame = useCallback(() => {
    playerLane.current = 1;
    playerYOffset.current = 0;
    isJumping.current = false;
    isSliding.current = false;
    obstacles.current = [];
    coinsList.current = [];
    gameSpeed.current = 3.0;
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
    jumpVelocity.current = 14;
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
    roadOffset.current = (roadOffset.current + gameSpeed.current * 5) % 100;

    // Jump / Gravity physics
    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.8;

    // Check if on a train
    let onTrain = false;
    obstacles.current.forEach(obs => {
      if (obs.type === 'train' || obs.type === 'ramp') {
        const trainStart = obs.z;
        const trainEnd = obs.z + obs.length;
        if (playerLane.current === obs.lane && trainStart < 50 && trainEnd > 20) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 5) {
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

    // Spawn logic
    if (frameCount.current % 100 === 0) {
      const rand = Math.random();
      if (rand > 0.4) {
        // Spawn Train
        const type = Math.random() > 0.5 ? 'ramp' : 'train';
        obstacles.current.push({ 
          lane: Math.floor(Math.random() * 3), 
          z: 700, 
          length: 300 + Math.random() * 300, 
          type: type,
          color: ['#1e3a8a', '#1e40af', '#334155'][Math.floor(Math.random() * 3)]
        });
      } else {
        // Spawn Barrier
        obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 700, length: 20, type: 'barrier', color: '#ef4444' });
      }
    }
    if (frameCount.current % 40 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 700 });

    gameSpeed.current += 0.0006;

    // Collision Detection
    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 6;
      
      const distStart = obj.z;
      const distEnd = obj.z + obj.length;

      if (obj.lane === playerLane.current && distStart < 40 && distEnd > 20) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           // Smooth ramp climb
           playerYOffset.current = TRAIN_HEIGHT;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 10) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && playerYOffset.current < 20) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 6;
      if (c.lane === playerLane.current && c.z > 20 && c.z < 45) {
        const charY = playerYOffset.current;
        if (Math.abs(charY - 0) < 30 || Math.abs(charY - TRAIN_HEIGHT) < 30) {
           setCoins(prev => prev + 1);
           c.z = -100;
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => o.z + o.length > -50);
    coinsList.current = coinsList.current.filter(c => c.z > -50);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const color = '#C41DFA';
    const bodyW = 30;
    const bodyH = isSliding.current ? 20 : 50;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2); ctx.fill();

    // Legs
    ctx.fillStyle = '#2600CC';
    ctx.fillRect(-10, -15, 8, 15);
    ctx.fillRect(2, -15, 8, 15);

    // Body
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(-15, -bodyH - 15, bodyW, bodyH, 8); ctx.fill();
    
    // Head
    ctx.fillStyle = '#ffccaa';
    ctx.beginPath(); ctx.arc(0, -bodyH - 30, 12, 0, Math.PI * 2); ctx.fill();
    
    // Cap
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-12, -bodyH - 42, 24, 8);
    ctx.fillRect(0, -bodyH - 42, 18, 4);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Ground
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Tracks
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 3; i++) {
      const xOffset = (i - 1.5) * 110;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
      ctx.lineTo(CANVAS_WIDTH/2 + xOffset * 10, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Draw Objects
    const allObjects = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin', color: '#FAC11D'}))
    ].sort((a, b) => b.z - a.z);

    allObjects.forEach(obj => {
      const scaleStart = FOV / (FOV + obj.z);
      const scaleEnd = FOV / (FOV + obj.z + obj.length);
      const laneX = (obj.lane - 1) * 110;
      
      const xStart = CANVAS_WIDTH / 2 + laneX * scaleStart;
      const xEnd = CANVAS_WIDTH / 2 + laneX * scaleEnd;
      const yStart = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleStart;
      const yEnd = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleEnd;

      if (obj.type === 'train' || obj.type === 'ramp') {
        ctx.fillStyle = obj.color;
        const wStart = 100 * scaleStart;
        const wEnd = 100 * scaleEnd;
        const hStart = TRAIN_HEIGHT * scaleStart;
        const hEnd = TRAIN_HEIGHT * scaleEnd;

        ctx.beginPath();
        // Drawing train as a 3D box
        ctx.moveTo(xStart - wStart/2, yStart);
        ctx.lineTo(xEnd - wEnd/2, yEnd);
        ctx.lineTo(xEnd + wEnd/2, yEnd);
        ctx.lineTo(xStart + wStart/2, yStart);
        ctx.fill();
        
        // Train Top
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(xStart - wStart/2, yStart - hStart);
        ctx.lineTo(xEnd - wEnd/2, yEnd - hEnd);
        ctx.lineTo(xEnd + wEnd/2, yEnd - hEnd);
        ctx.lineTo(xStart + wStart/2, yStart - hStart);
        ctx.fill();

        // Train Front (if ramp, draw slanted)
        if (obj.type === 'ramp') {
           ctx.fillStyle = 'rgba(255,255,255,0.2)';
           ctx.beginPath();
           ctx.moveTo(xStart - wStart/2, yStart);
           ctx.lineTo(xStart + wStart/2, yStart);
           ctx.lineTo(xStart + wStart/2, yStart - hStart);
           ctx.lineTo(xStart - wStart/2, yStart - hStart);
           ctx.fill();
        }
      } else if (obj.type === 'barrier') {
        const bW = 80 * scaleStart;
        const bH = 40 * scaleStart;
        ctx.fillStyle = obj.color;
        ctx.fillRect(xStart - bW/2, yStart - bH, bW, bH);
      } else if (obj.type === 'coin') {
        const cS = 30 * scaleStart;
        ctx.fillStyle = '#FAC11D';
        ctx.beginPath(); ctx.arc(xStart, yStart - 20 * scaleStart, cS/2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.stroke();
      }
    });

    // Player
    const playerLaneX = (playerLane.current - 1) * 110;
    const pScale = FOV / (FOV + 35);
    const px = CANVAS_WIDTH / 2 + playerLaneX * pScale;
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * pScale) - playerYOffset.current * pScale;
    drawCharacter(ctx, px, py, pScale * 1.5);

    // UI
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Space Grotesk';
    ctx.fillText(`DISTANCE: ${Math.floor(score / 10)} M`, 20, 40);
    ctx.fillText(`COINS: ${coins}`, 20, 70);
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
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 overflow-hidden touch-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[85vh] shadow-2xl" />
      
      {isMobile && !gameOver && (
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <Button size="icon" className="w-16 h-16 rounded-2xl bg-white/10" onClick={() => moveLane(-1)}><ArrowLeft className="h-8 w-8" /></Button>
            <Button size="icon" className="w-16 h-16 rounded-2xl bg-primary" onClick={jump}><ArrowUp className="h-8 w-8" /></Button>
            <Button size="icon" className="w-16 h-16 rounded-2xl bg-white/10" onClick={() => moveLane(1)}><ArrowRight className="h-8 w-8" /></Button>
          </div>
          <Button className="w-48 h-12 rounded-full bg-secondary font-bold text-lg" onClick={slide}><ArrowDown className="mr-2 h-6 w-6"/> SLIDE</Button>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 text-center z-30">
          <h2 className="text-7xl font-headline font-bold text-destructive mb-4 tracking-tighter italic">BUSTED</h2>
          <p className="text-3xl text-white font-headline font-bold mb-2">DISTANCE: {Math.floor(score / 10)} M</p>
          <p className="text-xl text-primary font-bold mb-10">TOTAL COINS: {coins}</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold bg-primary">
            <RotateCcw className="mr-3 h-8 w-8" /> REPLAY
          </Button>
        </div>
      )}
    </div>
  );
}
