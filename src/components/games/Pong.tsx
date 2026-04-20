
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Users, User, Zap } from 'lucide-react';
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
  const paddleSpeed = 15;
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  const initGame = useCallback(() => {
    playerY.current = 205;
    aiY.current = 205;
    ball.current = { x: 400, y: 250, vx: 6, vy: 4 };
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

    // Player Controls
    if (keysPressed.current['w']) playerY.current = Math.max(0, playerY.current - paddleSpeed);
    if (keysPressed.current['s']) playerY.current = Math.min(500 - paddleH, playerY.current + paddleSpeed);
    
    if (isTwoPlayer) {
      if (keysPressed.current['arrowup'] || keysPressed.current['o']) aiY.current = Math.max(0, aiY.current - paddleSpeed);
      if (keysPressed.current['arrowdown'] || keysPressed.current['l']) aiY.current = Math.min(500 - paddleH, aiY.current + paddleSpeed);
    } else {
      // ABSOLUTELY UNBEATABLE AI Logic
      // The AI is now instant. It centers itself on the ball every frame without lag.
      const aiTarget = ball.current.y - paddleH / 2;
      aiY.current = Math.max(0, Math.min(500 - paddleH, aiTarget));
    }

    ball.current.x += ball.current.vx;
    ball.current.y += ball.current.vy;

    // Wall bounce
    if (ball.current.y <= 10 || ball.current.y >= 490) ball.current.vy *= -1;

    const ballRadius = 10;
    
    // Player Paddle Collision
    if (ball.current.x <= 20 + paddleW + ballRadius && 
        ball.current.y >= playerY.current && 
        ball.current.y <= playerY.current + paddleH && 
        ball.current.vx < 0) {
      ball.current.vx = Math.abs(ball.current.vx) + 0.6; // Speed up
      setScore(s => s + 10);
      const impact = (ball.current.y - (playerY.current + paddleH/2)) / (paddleH/2);
      ball.current.vy = impact * 10;
    }

    // AI/Enemy Paddle Collision
    if (ball.current.x >= 780 - paddleW - ballRadius && 
        ball.current.y >= aiY.current && 
        ball.current.y <= aiY.current + paddleH && 
        ball.current.vx > 0) {
      ball.current.vx = -(Math.abs(ball.current.vx) + 0.6);
      if (isTwoPlayer) setScore(s => s + 10);
      const impact = (ball.current.y - (aiY.current + paddleH/2)) / (paddleH/2);
      ball.current.vy = impact * 10;
    }

    // Score / Game Over
    if (ball.current.x < -20 || ball.current.x > 820) {
      setGameOver(true);
    }
  }, [gameOver, score, isTwoPlayer]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 500);
    ctx.fillStyle = '#020617'; // Dark pro background
    ctx.fillRect(0, 0, 800, 500);
    
    ctx.setLineDash([15, 15]);
    ctx.strokeStyle = '#2600CC44';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, 500); ctx.stroke();
    ctx.setLineDash([]);

    // Grid lines for realism
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for(let i=0; i<800; i+=50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 500); ctx.stroke(); }
    for(let i=0; i<500; i+=50) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(800, i); ctx.stroke(); }

    const drawPaddle = (x: number, y: number, color: string) => {
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, paddleW, paddleH, 2);
      ctx.fill();
      ctx.restore();
    };
    
    drawPaddle(20, playerY.current, '#2600CC');
    drawPaddle(780 - paddleW, aiY.current, isTwoPlayer ? '#FA1D64' : '#C41DFA');
    
    // Ball - ensuring it is perfectly round
    ctx.save();
    ctx.fillStyle = '#FAC11D';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#FAC11D';
    ctx.beginPath(); 
    ctx.arc(ball.current.x, ball.current.y, 10, 0, Math.PI * 2); 
    ctx.fill();
    ctx.strokeStyle = 'white'; 
    ctx.lineWidth = 2; 
    ctx.stroke();
    ctx.restore();
  }, [isTwoPlayer]);

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
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center p-4 touch-none select-none bg-black">
      <div className="flex items-center gap-8">
        <div className="text-4xl font-headline font-bold text-primary italic tracking-tighter">SCORE: {score}</div>
        <div className="flex items-center space-x-4 bg-slate-900 px-6 py-2 border border-white/10 shadow-xl">
          <User className="h-4 w-4 text-muted-foreground" />
          <Switch id="two-player" checked={isTwoPlayer} onCheckedChange={(val) => { setIsTwoPlayer(val); initGame(); }} />
          <Users className="h-4 w-4 text-primary" />
          <Label htmlFor="two-player" className="font-black text-xs uppercase tracking-widest text-white">
            {isTwoPlayer ? "MULTI" : "AI GOD MODE"}
          </Label>
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
          className="w-full h-auto max-h-[65vh] border-x-[8px] border-primary/50 bg-[#020617] cursor-none aspect-[16/10] shadow-[0_0_100px_rgba(38,0,204,0.2)]" 
        />
        {!isTwoPlayer && (
          <div className="absolute top-6 right-6 bg-primary/20 backdrop-blur-md px-4 py-2 border border-primary/40 flex items-center gap-3">
            <Zap className="h-4 w-4 text-primary animate-pulse fill-current" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">ALGORITHME IMBATTABLE</span>
          </div>
        )}
      </div>

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 z-50 backdrop-blur-xl">
          <h2 className="text-8xl font-headline font-bold text-destructive mb-6 tracking-tighter italic">FIN DE MATCH</h2>
          <p className="text-4xl font-headline font-bold mb-12 text-white">SCORE: {score}</p>
          <Button onClick={initGame} size="lg" className="rounded-none px-20 py-12 text-4xl font-black bg-primary text-white shadow-2xl border-b-8 border-primary/50 italic">
            REJOUER
          </Button>
        </div>
      )}
    </div>
  );
}
