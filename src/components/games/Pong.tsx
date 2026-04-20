
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
  const paddleSpeed = 12;
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  const initGame = useCallback(() => {
    playerY.current = 205;
    aiY.current = 205;
    ball.current = { x: 400, y: 250, vx: 5, vy: 3 };
    setScore(0);
    setGameOver(false);
  }, []);

  const handleTouch = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (gameOver) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touches = 'touches' in e ? Array.from(e.touches) : [e];
    
    touches.forEach((t: any) => {
      const clientY = 'clientY' in t ? t.clientY : (t as any).pageY;
      const clientX = 'clientX' in t ? t.clientX : (t as any).pageX;
      
      const touchY = clientY - rect.top;
      const touchX = clientX - rect.left;
      
      const scaleY = 500 / rect.height;
      const scaledY = touchY * scaleY - paddleH / 2;
      const clampedY = Math.max(0, Math.min(500 - paddleH, scaledY));

      if (isTwoPlayer) {
        if (touchX < rect.width / 2) {
          playerY.current = clampedY;
        } else {
          aiY.current = clampedY;
        }
      } else {
        playerY.current = clampedY;
      }
    });
  }, [isTwoPlayer, gameOver]);

  const update = useCallback(() => {
    if (gameOver) return;

    if (keysPressed.current['w']) playerY.current = Math.max(0, playerY.current - paddleSpeed);
    if (keysPressed.current['s']) playerY.current = Math.min(500 - paddleH, playerY.current + paddleSpeed);
    
    if (isTwoPlayer) {
      if (keysPressed.current['arrowup'] || keysPressed.current['o']) aiY.current = Math.max(0, aiY.current - paddleSpeed);
      if (keysPressed.current['arrowdown'] || keysPressed.current['l']) aiY.current = Math.min(500 - paddleH, aiY.current + paddleSpeed);
    } else {
      const aiTarget = ball.current.y - paddleH / 2;
      const aiSpeed = 4.5 + (score / 1500);
      const diff = aiTarget - aiY.current;
      aiY.current += Math.sign(diff) * Math.min(Math.abs(diff), aiSpeed);
      aiY.current = Math.max(0, Math.min(500 - paddleH, aiY.current));
    }

    ball.current.x += ball.current.vx;
    ball.current.y += ball.current.vy;

    if (ball.current.y <= 10 || ball.current.y >= 490) ball.current.vy *= -1;

    const ballRadius = 10;
    
    if (ball.current.x <= 20 + paddleW + ballRadius && 
        ball.current.y >= playerY.current && 
        ball.current.y <= playerY.current + paddleH && 
        ball.current.vx < 0) {
      ball.current.vx = Math.abs(ball.current.vx) + 0.5;
      setScore(s => s + 10);
      const impact = (ball.current.y - (playerY.current + paddleH/2)) / (paddleH/2);
      ball.current.vy = impact * 8;
    }

    if (ball.current.x >= 780 - paddleW - ballRadius && 
        ball.current.y >= aiY.current && 
        ball.current.y <= aiY.current + paddleH && 
        ball.current.vx > 0) {
      ball.current.vx = -(Math.abs(ball.current.vx) + 0.5);
      if (isTwoPlayer) setScore(s => s + 10);
      const impact = (ball.current.y - (aiY.current + paddleH/2)) / (paddleH/2);
      ball.current.vy = impact * 8;
    }

    if (ball.current.x < -20 || ball.current.x > 820) {
      setGameOver(true);
    }
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
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#2600CC44';
    
    const drawPaddle = (x: number, y: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, paddleW, paddleH, 6);
      ctx.fill();
    };
    
    drawPaddle(20, playerY.current);
    drawPaddle(780 - paddleW, aiY.current);
    
    // Draw perfect circle for the ball
    ctx.save();
    ctx.fillStyle = '#FA1D64';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FA1D6466';
    ctx.beginPath(); 
    ctx.arc(ball.current.x, ball.current.y, 10, 0, Math.PI * 2); 
    ctx.fill();
    ctx.strokeStyle = 'white'; 
    ctx.lineWidth = 2; 
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = true; };
    const handleUp = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  useEffect(() => {
    if (gameOver) onGameOver(score);
  }, [gameOver, score, onGameOver]);

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center p-4 touch-none select-none">
      <div className="flex items-center gap-8">
        <div className="text-4xl font-headline font-bold text-primary">Score: {score}</div>
        <div className="flex items-center space-x-2 bg-muted px-4 py-2 rounded-full border shadow-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <Switch id="two-player" checked={isTwoPlayer} onCheckedChange={(val) => { setIsTwoPlayer(val); initGame(); }} />
          <Users className="h-4 w-4 text-primary" />
          <Label htmlFor="two-player" className="font-bold text-xs uppercase tracking-wider">2 Joueurs</Label>
        </div>
      </div>
      
      <div 
        className="relative w-full max-w-4xl"
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onMouseMove={(e) => { if (e.buttons === 1) handleTouch(e as any); }}
      >
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={500} 
          className="w-full h-auto max-h-[60vh] border-4 border-primary rounded-3xl bg-white shadow-2xl cursor-crosshair aspect-[16/10]" 
        />
      </div>

      {gameOver && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 z-30 backdrop-blur-md">
          <h2 className="text-7xl font-headline font-bold text-destructive mb-6 tracking-tighter">GAME OVER</h2>
          <p className="text-3xl font-headline font-bold mb-10">Score Final: {score}</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-16 py-10 text-3xl font-bold shadow-2xl hover:scale-105 transition-transform">
            <RotateCcw className="mr-3 h-10 w-10" /> Rejouer
          </Button>
        </div>
      )}
    </div>
  );
}
