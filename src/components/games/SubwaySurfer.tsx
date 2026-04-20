
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
  const TRACK_COUNT = 3;
  const TRACK_WIDTH = CANVAS_WIDTH / TRACK_COUNT;

  const playerLane = useRef(1); // 0, 1, 2
  const playerYOffset = useRef(0);
  const playerHeight = useRef(60);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, y: number, type: 'jump' | 'slide' }[]>([]);
  const coinsList = useRef<{ lane: number, y: number }[]>([]);
  const gameSpeed = useRef(6);
  const frameCount = useRef(0);

  const initGame = useCallback(() => {
    playerLane.current = 1;
    playerYOffset.current = 0;
    playerHeight.current = 60;
    isJumping.current = false;
    isSliding.current = false;
    obstacles.current = [];
    coinsList.current = [];
    gameSpeed.current = 6;
    frameCount.current = 0;
    setScore(0);
    setCoins(0);
    setGameOver(false);
  }, []);

  const moveLane = (dir: number) => {
    if (gameOver) return;
    const nextLane = playerLane.current + dir;
    if (nextLane >= 0 && nextLane < TRACK_COUNT) {
      playerLane.current = nextLane;
    }
  };

  const jump = () => {
    if (gameOver || isJumping.current) return;
    isJumping.current = true;
    jumpVelocity.current = 15;
    isSliding.current = false;
    playerHeight.current = 60;
  };

  const slide = () => {
    if (gameOver || isSliding.current) return;
    isSliding.current = true;
    playerHeight.current = 30;
    setTimeout(() => {
      isSliding.current = false;
      playerHeight.current = 60;
    }, 800);
  };

  const update = useCallback(() => {
    if (gameOver) return;

    frameCount.current++;
    setScore(s => s + 1);

    // Jump physics
    if (isJumping.current) {
      playerYOffset.current += jumpVelocity.current;
      jumpVelocity.current -= 0.8;
      if (playerYOffset.current <= 0) {
        playerYOffset.current = 0;
        isJumping.current = false;
      }
    }

    // Spawn logic
    if (frameCount.current % 100 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const type = Math.random() > 0.5 ? 'jump' : 'slide';
      obstacles.current.push({ lane, y: -100, type });
    }

    if (frameCount.current % 40 === 0) {
      coinsList.current.push({ lane: Math.floor(Math.random() * 3), y: -100 });
    }

    // Move everything
    gameSpeed.current += 0.001;

    obstacles.current.forEach(o => {
      o.y += gameSpeed.current;
      
      // Collision
      const playerX = playerLane.current * TRACK_WIDTH + (TRACK_WIDTH - 40) / 2;
      const obstacleX = o.lane * TRACK_WIDTH + (TRACK_WIDTH - 60) / 2;
      
      if (o.y > CANVAS_HEIGHT - 120 && o.y < CANVAS_HEIGHT - 60) {
        if (o.lane === playerLane.current) {
          if (o.type === 'jump' && playerYOffset.current < 40) setGameOver(true);
          if (o.type === 'slide' && !isSliding.current) setGameOver(true);
        }
      }
    });

    coinsList.current.forEach((c, idx) => {
      c.y += gameSpeed.current;
      if (c.lane === playerLane.current && c.y > CANVAS_HEIGHT - 120 && c.y < CANVAS_HEIGHT - 60) {
        setCoins(prev => prev + 1);
        coinsList.current.splice(idx, 1);
      }
    });

    obstacles.current = obstacles.current.filter(o => o.y < CANVAS_HEIGHT + 100);
    coinsList.current = coinsList.current.filter(c => c.y < CANVAS_HEIGHT + 100);

  }, [gameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Tracks
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.strokeStyle = '#333';
    ctx.setLineDash([20, 20]);
    for (let i = 1; i < TRACK_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * TRACK_WIDTH, 0);
      ctx.lineTo(i * TRACK_WIDTH, CANVAS_HEIGHT);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Coins
    ctx.fillStyle = '#FAC11D';
    coinsList.current.forEach(c => {
      const x = c.lane * TRACK_WIDTH + TRACK_WIDTH / 2;
      ctx.beginPath();
      ctx.arc(x, c.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.stroke();
    });

    // Obstacles
    obstacles.current.forEach(o => {
      const x = o.lane * TRACK_WIDTH + (TRACK_WIDTH - 80) / 2;
      if (o.type === 'jump') {
        ctx.fillStyle = '#FA1D64'; // Barrier to jump
        ctx.fillRect(x, o.y, 80, 40);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, o.y, 80, 40);
      } else {
        ctx.fillStyle = '#2600CC'; // Barrier to slide under
        ctx.fillRect(x, o.y, 80, 20);
        ctx.fillRect(x, o.y, 10, 100);
        ctx.fillRect(x + 70, o.y, 10, 100);
      }
    });

    // Player
    const px = playerLane.current * TRACK_WIDTH + (TRACK_WIDTH - 40) / 2;
    const py = CANVAS_HEIGHT - 100 - playerYOffset.current;
    
    ctx.fillStyle = '#C41DFA';
    ctx.beginPath();
    ctx.roundRect(px, py + (60 - playerHeight.current), 40, playerHeight.current, 10);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Stats
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Space Grotesk';
    ctx.fillText(`M: ${Math.floor(score / 10)}`, 20, 40);
    ctx.fillText(`Coins: ${coins}`, 20, 70);
  }, [score, coins]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  // Controls
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

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10) + coins * 10); }, [gameOver, score, coins, onGameOver]);

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 overflow-hidden touch-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[75vh] bg-zinc-900 shadow-2xl" />
      
      {isMobile && !gameOver && (
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2">
          <div className="flex gap-4">
            <Button size="icon" className="w-16 h-16 rounded-2xl bg-white/10" onClick={() => moveLane(-1)}><ArrowLeft /></Button>
            <Button size="icon" className="w-16 h-16 rounded-2xl bg-primary" onClick={jump}><ArrowUp /></Button>
            <Button size="icon" className="w-16 h-16 rounded-2xl bg-white/10" onClick={() => moveLane(1)}><ArrowRight /></Button>
          </div>
          <Button className="w-48 h-12 rounded-full bg-secondary" onClick={slide}><ArrowDown className="mr-2"/> SLIDE</Button>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 text-center z-30">
          <h2 className="text-6xl font-headline font-bold text-destructive mb-4 tracking-tighter">BUSTED</h2>
          <p className="text-3xl text-white font-headline font-bold mb-2">Distance: {Math.floor(score / 10)} m</p>
          <p className="text-xl text-primary font-bold mb-8">Coins: {coins}</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold">
            <RotateCcw className="mr-3 h-8 w-8" /> PLAY AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
