"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Users, User } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function Pong({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isTwoPlayer, setIsTwoPlayer] = useState(false);
  const gameLoopRef = useRef<number>(0);

  const paddleH = 90;
  const paddleW = 12;
  const playerY = useRef(205);
  const aiY = useRef(205);
  const ball = useRef({ x: 400, y: 250, vx: 5, vy: 3 });
  const paddleSpeed = 10;
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

    // Player 1 (W/S or Up/Down if single)
    if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) playerY.current = Math.max(0, playerY.current - paddleSpeed);
    if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) playerY.current = Math.min(500 - paddleH, playerY.current + paddleSpeed);

    // Player 2 or AI
    if (isTwoPlayer) {
      if (keysPressed.current['o']) aiY.current = Math.max(0, aiY.current - paddleSpeed);
      if (keysPressed.current['l']) aiY.current = Math.min(500 - paddleH, aiY.current + paddleSpeed);
    } else {
      const aiTarget = ball.current.y - paddleH / 2;
      const aiSpeed = 4.5 + (score / 1000);
      if (aiY.current < aiTarget) aiY.current = Math.min(500 - paddleH, aiY.current + aiSpeed);
      else aiY.current = Math.max(0, aiY.current - aiSpeed);
    }

    ball.current.x += ball.current.vx;
    ball.current.y += ball.current.vy;

    if (ball.current.y <= 0 || ball.current.y >= 500) ball.current.vy *= -1;

    // Collisions
    if (ball.current.x <= 20 + paddleW && ball.current.y >= playerY.current && ball.current.y <= playerY.current + paddleH && ball.current.vx < 0) {
      ball.current.vx = Math.abs(ball.current.vx) + 0.5;
      setScore(s => s + 10);
      ball.current.vy = ((ball.current.y - (playerY.current + paddleH/2)) / (paddleH/2)) * 7;
    }

    if (ball.current.x >= 780 - paddleW && ball.current.y >= aiY.current && ball.current.y <= aiY.current + paddleH && ball.current.vx > 0) {
      ball.current.vx = -(Math.abs(ball.current.vx) + 0.5);
      if (isTwoPlayer) setScore(s => s + 10);
    }

    if (ball.current.x < 0 || ball.current.x > 800) setGameOver(true);
  }, [gameOver, score, isTwoPlayer]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 500);
    ctx.fillStyle = '#FDFCFE';
    ctx.fillRect(0, 0, 800, 500);
    
    ctx.setLineDash([15, 15]);
    ctx.strokeStyle = '#2600CC22';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, 500); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#2600CC';
    ctx.fillRect(20, playerY.current, paddleW, paddleH);
    ctx.fillRect(780 - paddleW, aiY.current, paddleW, paddleH);
    
    ctx.fillStyle = '#FA1D64';
    ctx.beginPath(); ctx.arc(ball.current.x, ball.current.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = true; if (e.key === 'ArrowUp') keysPressed.current['ArrowUp'] = true; if (e.key === 'ArrowDown') keysPressed.current['ArrowDown'] = true; };
    const handleUp = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = false; if (e.key === 'ArrowUp') keysPressed.current['ArrowUp'] = false; if (e.key === 'ArrowDown') keysPressed.current['ArrowDown'] = false; };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  const moveManual = (side: 'left' | 'right', dir: 'up' | 'down') => {
    if (side === 'left') playerY.current = Math.max(0, playerY.current + (dir === 'up' ? -50 : 50));
    else aiY.current = Math.max(0, aiY.current + (dir === 'up' ? -50 : 50));
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center p-4">
      <div className="flex items-center gap-8">
        <div className="text-4xl font-headline font-bold text-primary">Score: {score}</div>
        <div className="flex items-center space-x-2 bg-muted px-4 py-2 rounded-full border">
          <User className="h-4 w-4 text-muted-foreground" />
          <Switch id="two-player" checked={isTwoPlayer} onCheckedChange={setIsTwoPlayer} />
          <Users className="h-4 w-4 text-primary" />
          <Label htmlFor="two-player" className="font-bold text-xs uppercase tracking-wider">2 Players Mode</Label>
        </div>
      </div>
      
      <canvas ref={canvasRef} width={800} height={500} className="w-full h-auto max-h-[55vh] border-4 border-primary rounded-3xl bg-white shadow-2xl" />
      
      {isMobile && !gameOver && (
        <div className="flex w-full justify-between max-w-4xl px-4">
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="h-16 w-20 rounded-2xl" onTouchStart={() => moveManual('left', 'up')}><User className="h-6 w-6" /></Button>
            <Button variant="outline" className="h-16 w-20 rounded-2xl" onTouchStart={() => moveManual('left', 'down')}><User className="h-6 w-6" /></Button>
          </div>
          {isTwoPlayer && (
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="h-16 w-20 rounded-2xl border-primary" onTouchStart={() => moveManual('right', 'up')}><Users className="h-6 w-6 text-primary" /></Button>
              <Button variant="outline" className="h-16 w-20 rounded-2xl border-primary" onTouchStart={() => moveManual('right', 'down')}><Users className="h-6 w-6 text-primary" /></Button>
            </div>
          )}
        </div>
      )}

      {!isMobile && !gameOver && (
        <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium flex gap-8">
          <span>P1: W/S or Arrow Keys</span>
          {isTwoPlayer && <span>P2: O/L Keys</span>}
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 z-30 backdrop-blur-sm">
          <h2 className="text-6xl font-headline font-bold text-destructive mb-4 tracking-tighter">GAME OVER</h2>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold"><RotateCcw className="mr-3 h-8 w-8" /> Restart</Button>
        </div>
      )}
    </div>
  );
}
