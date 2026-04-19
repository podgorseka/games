
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';

export default function Pong({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const paddleH = 90;
  const paddleW = 12;
  const playerY = useRef(205);
  const aiY = useRef(205);
  const ball = useRef({ x: 400, y: 250, vx: 5, vy: 3 });
  const paddleSpeed = 8;
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  const initGame = useCallback(() => {
    playerY.current = 205;
    aiY.current = 205;
    ball.current = { x: 400, y: 250, vx: 5, vy: 3 };
    setScore(0);
    setGameOver(false);
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    // Player movement
    if (keysPressed.current['ArrowUp']) playerY.current = Math.max(0, playerY.current - paddleSpeed);
    if (keysPressed.current['ArrowDown']) playerY.current = Math.min(500 - paddleH, playerY.current + paddleSpeed);

    // Ball movement
    ball.current.x += ball.current.vx;
    ball.current.y += ball.current.vy;

    // Wall bounce
    if (ball.current.y <= 0 || ball.current.y >= 500) ball.current.vy *= -1;

    // AI logic (Simplified follow)
    const aiTarget = ball.current.y - paddleH / 2;
    const aiSpeed = 4.5 + (score / 1000); // AI gets faster over time
    if (aiY.current < aiTarget) aiY.current = Math.min(500 - paddleH, aiY.current + aiSpeed);
    else aiY.current = Math.max(0, aiY.current - aiSpeed);

    // Player collision
    if (
      ball.current.x <= 20 + paddleW && 
      ball.current.y >= playerY.current && 
      ball.current.y <= playerY.current + paddleH &&
      ball.current.vx < 0
    ) {
      ball.current.vx = Math.abs(ball.current.vx) + 0.3;
      setScore(s => s + 10);
      // Add angle based on where it hit the paddle
      const impact = (ball.current.y - (playerY.current + paddleH/2)) / (paddleH/2);
      ball.current.vy = impact * 6;
    }

    // AI collision
    if (
      ball.current.x >= 780 - paddleW && 
      ball.current.y >= aiY.current && 
      ball.current.y <= aiY.current + paddleH &&
      ball.current.vx > 0
    ) {
      ball.current.vx = -(Math.abs(ball.current.vx) + 0.3);
    }

    // Score / Game Over
    if (ball.current.x < 0) setGameOver(true);
    if (ball.current.x > 800) {
      // Point scored by player
      setScore(s => s + 50);
      ball.current = { x: 400, y: 250, vx: -5, vy: 3 }; // Reset ball towards player
    }
  }, [gameOver, score]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 500);
    
    // Background
    ctx.fillStyle = '#FDFCFE';
    ctx.fillRect(0, 0, 800, 500);
    
    // Center Line
    ctx.setLineDash([15, 15]);
    ctx.strokeStyle = '#2600CC22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(400, 0);
    ctx.lineTo(400, 500);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles
    ctx.fillStyle = '#2600CC';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#2600CC44';
    // Player
    ctx.fillRect(20, playerY.current, paddleW, paddleH);
    // AI
    ctx.fillRect(780 - paddleW, aiY.current, paddleW, paddleH);
    ctx.shadowBlur = 0;
    
    // Ball
    ctx.fillStyle = '#FA1D64';
    ctx.beginPath();
    ctx.arc(ball.current.x, ball.current.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => { keysPressed.current[e.key] = true; };
    const handleUp = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  useEffect(() => { if (gameOver) onGameOver(score); }, [gameOver, score, onGameOver]);

  const moveManual = (dir: 'up' | 'down') => {
    if (dir === 'up') playerY.current = Math.max(0, playerY.current - 50);
    else playerY.current = Math.min(500 - paddleH, playerY.current + 50);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center p-4">
      <div className="text-4xl font-headline font-bold text-primary">Score: {score}</div>
      <canvas ref={canvasRef} width={800} height={500} className="w-full h-auto max-h-[60vh] border-4 border-primary rounded-3xl bg-white shadow-2xl" />
      
      {isMobile && !gameOver && (
        <div className="flex gap-12 mt-4">
          <Button variant="outline" className="h-20 w-32 rounded-2xl shadow-lg border-2" onClick={() => moveManual('up')}>
            <ArrowUp className="h-10 w-10 text-primary" />
          </Button>
          <Button variant="outline" className="h-20 w-32 rounded-2xl shadow-lg border-2" onClick={() => moveManual('down')}>
            <ArrowDown className="h-10 w-10 text-primary" />
          </Button>
        </div>
      )}

      {!isMobile && !gameOver && (
        <p className="text-muted-foreground font-medium uppercase tracking-widest text-sm">Use Up/Down Arrow Keys</p>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 z-30 backdrop-blur-sm">
          <h2 className="text-6xl font-headline font-bold text-destructive mb-4 tracking-tighter">MISSED!</h2>
          <p className="text-3xl font-headline font-bold mb-8">Score: {score}</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold shadow-xl">
            <RotateCcw className="mr-3 h-8 w-8" /> Restart
          </Button>
        </div>
      )}
    </div>
  );
}
