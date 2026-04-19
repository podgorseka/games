"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';

export default function Pong({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const paddleH = 80;
  const paddleW = 10;
  const playerY = useRef(210);
  const aiY = useRef(210);
  const ball = useRef({ x: 400, y: 250, vx: 5, vy: 3 });
  const paddleSpeed = 8;

  const moveUp = () => { playerY.current = Math.max(0, playerY.current - 40); };
  const moveDown = () => { playerY.current = Math.min(420, playerY.current + 40); };

  const initGame = useCallback(() => {
    playerY.current = 210;
    aiY.current = 210;
    ball.current = { x: 400, y: 250, vx: 5, vy: 3 };
    setScore(0);
    setGameOver(false);
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    ball.current.x += ball.current.vx;
    ball.current.y += ball.current.vy;

    // Wall bounce
    if (ball.current.y < 0 || ball.current.y > 490) ball.current.vy *= -1;

    // AI logic
    const aiTarget = ball.current.y - paddleH / 2;
    if (aiY.current < aiTarget) aiY.current += 3.5;
    else aiY.current -= 3.5;

    // Player collision
    if (ball.current.x < 20 + paddleW && ball.current.y > playerY.current && ball.current.y < playerY.current + paddleH) {
      ball.current.vx = Math.abs(ball.current.vx) + 0.5;
      ball.current.vx *= 1;
      setScore(s => s + 10);
    }

    // AI collision
    if (ball.current.x > 770 && ball.current.y > aiY.current && ball.current.y < aiY.current + paddleH) {
      ball.current.vx = -(Math.abs(ball.current.vx) + 0.5);
    }

    // Score / Game Over
    if (ball.current.x < 0) setGameOver(true);
    if (ball.current.x > 800) {
      ball.current = { x: 400, y: 250, vx: 5, vy: 3 }; // Point scored by player but we reset for solo
      setScore(s => s + 50);
    }
  }, [gameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 500);
    ctx.fillStyle = '#F7F0F9';
    ctx.fillRect(0, 0, 800, 500);
    
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = '#CCC';
    ctx.beginPath();
    ctx.moveTo(400, 0);
    ctx.lineTo(400, 500);
    ctx.stroke();

    ctx.fillStyle = '#2600CC';
    ctx.fillRect(20, playerY.current, paddleW, paddleH);
    ctx.fillRect(770, aiY.current, paddleW, paddleH);
    
    ctx.fillStyle = '#C41DFA';
    ctx.beginPath();
    ctx.arc(ball.current.x, ball.current.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') playerY.current = Math.max(0, playerY.current - paddleSpeed * 2);
      if (e.key === 'ArrowDown') playerY.current = Math.min(420, playerY.current + paddleSpeed * 2);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => { if (gameOver) onGameOver(score); }, [gameOver, score, onGameOver]);

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full justify-center">
      <div className="text-3xl font-headline font-bold text-primary">Score: {score}</div>
      <canvas ref={canvasRef} width={800} height={500} className="w-full h-auto max-h-[60vh] border-4 border-primary rounded-2xl bg-white shadow-xl" />
      {isMobile && !gameOver && (
        <div className="flex gap-8 mt-4">
          <Button variant="outline" className="h-20 w-32" onClick={moveUp}><ArrowUp className="h-8 w-8" /></Button>
          <Button variant="outline" className="h-20 w-32" onClick={moveDown}><ArrowDown className="h-8 w-8" /></Button>
        </div>
      )}
      {gameOver && (
        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center p-4 z-30">
          <h2 className="text-4xl font-headline font-bold text-destructive mb-2">MISSED!</h2>
          <p className="text-xl mb-6">Score: {score}</p>
          <Button onClick={initGame} size="lg"><RotateCcw className="mr-2 h-4 w-4" /> Restart</Button>
        </div>
      )}
    </div>
  );
}
