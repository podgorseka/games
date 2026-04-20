
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
  
  // Pseudo-3D Perspective constants
  const HORIZON = CANVAS_HEIGHT * 0.4;
  const FOV = 100;

  const playerLane = useRef(1); // 0, 1, 2
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, type: 'jump' | 'slide' }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(2.5);
  const roadOffset = useRef(0);
  const frameCount = useRef(0);

  const initGame = useCallback(() => {
    playerLane.current = 1;
    playerYOffset.current = 0;
    isJumping.current = false;
    isSliding.current = false;
    obstacles.current = [];
    coinsList.current = [];
    gameSpeed.current = 2.5;
    roadOffset.current = 0;
    frameCount.current = 0;
    setScore(0);
    setCoins(0);
    setGameOver(false);
  }, []);

  const moveLane = (dir: number) => {
    if (gameOver) return;
    const nextLane = playerLane.current + dir;
    if (nextLane >= 0 && nextLane < 3) {
      playerLane.current = nextLane;
    }
  };

  const jump = () => {
    if (gameOver || isJumping.current) return;
    isJumping.current = true;
    jumpVelocity.current = 12;
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
    roadOffset.current = (roadOffset.current + gameSpeed.current * 4) % 100;

    // Jump physics
    if (isJumping.current) {
      playerYOffset.current += jumpVelocity.current;
      jumpVelocity.current -= 0.6;
      if (playerYOffset.current <= 0) {
        playerYOffset.current = 0;
        isJumping.current = false;
      }
    }

    // Spawn logic
    if (frameCount.current % 80 === 0) {
      const type = Math.random() > 0.5 ? 'jump' : 'slide';
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 600, type });
    }
    if (frameCount.current % 30 === 0) {
      coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 600 });
    }

    gameSpeed.current += 0.0005;

    // Update Objects
    const updateObject = (obj: { lane: number, z: number }) => {
      obj.z -= gameSpeed.current * 5;
      
      // Collision at Z ~ horizon perspective offset
      if (obj.z > 10 && obj.z < 35) {
        if (obj.lane === playerLane.current) {
          if ('type' in obj) {
            const obs = obj as any;
            if (obs.type === 'jump' && playerYOffset.current < 40) setGameOver(true);
            if (obs.type === 'slide' && !isSliding.current) setGameOver(true);
          } else {
            setCoins(c => c + 1);
            obj.z = -100; // Collect
          }
        }
      }
    };

    obstacles.current.forEach(updateObject);
    coinsList.current.forEach(updateObject);

    obstacles.current = obstacles.current.filter(o => o.z > -20);
    coinsList.current = coinsList.current.filter(c => c.z > -20);
  }, [gameOver, isSliding]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background Sky
    const grad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Track
    ctx.fillStyle = '#111';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // 3D Lanes and Road Lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 3; i++) {
      const xOffset = (i - 1.5) * 100;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
      ctx.lineTo(CANVAS_WIDTH/2 + xOffset * 10, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Road dashes
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 20; i++) {
      const z = i * 40 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    const drawObject = (lane: number, z: number, color: string, type?: string) => {
      const scale = FOV / (FOV + z);
      const laneX = (lane - 1) * 100;
      const x = CANVAS_WIDTH / 2 + laneX * scale;
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      
      const size = 50 * scale;
      ctx.fillStyle = color;
      
      if (!type) { // Coin
        ctx.beginPath();
        ctx.arc(x, y - 10 * scale, size/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.stroke();
      } else if (type === 'jump') {
        ctx.fillRect(x - size, y - size, size * 2, size);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x - size, y - size, size * 2, size);
      } else {
        ctx.fillRect(x - size, y - size * 2, size * 2, size);
        ctx.strokeRect(x - size, y - size * 2, size * 2, size);
      }
    };

    // Draw all objects sorted by depth
    const allObjects = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false}))
    ].sort((a, b) => b.z - a.z);

    allObjects.forEach(obj => {
      drawObject(obj.lane, obj.z, obj.isObs ? (obj as any).type === 'jump' ? '#FA1D64' : '#2600CC' : '#FAC11D', (obj as any).type);
    });

    // Player
    const playerScale = 1.0;
    const playerLaneX = (playerLane.current - 1) * 100;
    const px = CANVAS_WIDTH / 2 + playerLaneX * (FOV / (FOV + 30));
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * (FOV / (FOV + 30))) - playerYOffset.current;
    
    ctx.fillStyle = '#C41DFA';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#C41DFA';
    const pWidth = 40;
    const pHeight = isSliding.current ? 30 : 60;
    ctx.beginPath();
    ctx.roundRect(px - pWidth/2, py - pHeight, pWidth, pHeight, 10);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // UI
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Space Grotesk';
    ctx.fillText(`M: ${Math.floor(score / 10)}`, 20, 40);
    ctx.fillText(`COINS: ${coins}`, 20, 70);
  }, [score, coins, isSliding]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  // Swipe logic
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
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 overflow-hidden touch-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[80vh] shadow-2xl" />
      
      {isMobile && !gameOver && (
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <Button size="icon" className="w-14 h-14 rounded-xl bg-white/10" onClick={() => moveLane(-1)}><ArrowLeft /></Button>
            <Button size="icon" className="w-14 h-14 rounded-xl bg-primary" onClick={jump}><ArrowUp /></Button>
            <Button size="icon" className="w-14 h-14 rounded-xl bg-white/10" onClick={() => moveLane(1)}><ArrowRight /></Button>
          </div>
          <Button className="w-40 h-10 rounded-full bg-secondary font-bold" onClick={slide}><ArrowDown className="mr-2 h-4 w-4"/> SLIDE</Button>
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
