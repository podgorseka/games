
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowLeft, ArrowRight } from 'lucide-react';

export default function MrRacer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);

  // Game constants
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 600;
  const PLAYER_WIDTH = 40;
  const PLAYER_HEIGHT = 70;
  const LANE_WIDTH = CANVAS_WIDTH / 4;
  
  // Game state
  const playerPos = useRef({ x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 120 });
  const enemies = useRef<{ x: number, y: number, speed: number, color: string }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameSpeed = useRef(5);

  const initGame = useCallback(() => {
    playerPos.current = { x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 120 };
    enemies.current = [];
    roadOffset.current = 0;
    gameSpeed.current = 5;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    const lane = Math.floor(Math.random() * 4);
    const x = lane * LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2;
    const colors = ['#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D', '#000000'];
    enemies.current.push({
      x,
      y: -100,
      speed: gameSpeed.current * (0.5 + Math.random() * 0.5),
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    // Movement
    const moveSpeed = 7;
    if (keys.current['ArrowLeft'] || keys.current['a']) playerPos.current.x -= moveSpeed;
    if (keys.current['ArrowRight'] || keys.current['d']) playerPos.current.x += moveSpeed;

    // Boundary check
    playerPos.current.x = Math.max(10, Math.min(CANVAS_WIDTH - PLAYER_WIDTH - 10, playerPos.current.x));

    // Road scroll
    roadOffset.current = (roadOffset.current + gameSpeed.current) % 100;

    // Increase difficulty
    gameSpeed.current += 0.001;
    setScore(s => s + 1);

    // Enemies
    if (Math.random() < 0.02) spawnEnemy();
    
    enemies.current.forEach(e => {
      e.y += gameSpeed.current + 2;

      // Collision
      if (
        playerPos.current.x < e.x + PLAYER_WIDTH &&
        playerPos.current.x + PLAYER_WIDTH > e.x &&
        playerPos.current.y < e.y + PLAYER_HEIGHT &&
        playerPos.current.y + PLAYER_HEIGHT > e.y
      ) {
        setGameOver(true);
      }
    });

    enemies.current = enemies.current.filter(e => e.y < CANVAS_HEIGHT + 100);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    // Body
    ctx.beginPath();
    ctx.roundRect(x, y, PLAYER_WIDTH, PLAYER_HEIGHT, 8);
    ctx.fill();
    
    // Windshield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x + 5, y + 15, PLAYER_WIDTH - 10, 15);
    
    // Headlights
    ctx.fillStyle = 'yellow';
    ctx.fillRect(x + 5, y, 8, 5);
    ctx.fillRect(x + PLAYER_WIDTH - 13, y, 8, 5);

    // Wheels
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 2, y + 10, 4, 15);
    ctx.fillRect(x + PLAYER_WIDTH - 2, y + 10, 4, 15);
    ctx.fillRect(x - 2, y + 45, 4, 15);
    ctx.fillRect(x + PLAYER_WIDTH - 2, y + 45, 4, 15);
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Asphalt
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Lane markings
    ctx.strokeStyle = 'white';
    ctx.setLineDash([40, 60]);
    ctx.lineWidth = 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LANE_WIDTH, -100 + roadOffset.current);
      ctx.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT + 100);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Enemies
    enemies.current.forEach(e => drawCar(ctx, e.x, e.y, e.color));

    // Player
    drawCar(ctx, playerPos.current.x, playerPos.current.y, '#C41DFA');

    // Score overlay
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Space Grotesk';
    ctx.fillText(`KM: ${Math.floor(score / 10)}`, 20, 40);
  }, [score]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => keys.current[e.key] = true;
    const handleUp = (e: KeyboardEvent) => keys.current[e.key] = false;
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10)); }, [gameOver, score, onGameOver]);

  const handleMobilePress = (dir: 'left' | 'right', active: boolean) => {
    if (dir === 'left') keys.current['ArrowLeft'] = active;
    if (dir === 'right') keys.current['ArrowRight'] = active;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-900 overflow-hidden touch-none">
      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[80vh] bg-zinc-800 shadow-2xl" />
      
      {isMobile && !gameOver && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-20 pointer-events-auto">
          <Button 
            className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/20"
            onPointerDown={() => handleMobilePress('left', true)}
            onPointerUp={() => handleMobilePress('left', false)}
            onPointerLeave={() => handleMobilePress('left', false)}
          >
            <ArrowLeft className="h-12 w-12" />
          </Button>
          <Button 
            className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/20"
            onPointerDown={() => handleMobilePress('right', true)}
            onPointerUp={() => handleMobilePress('right', false)}
            onPointerLeave={() => handleMobilePress('right', false)}
          >
            <ArrowRight className="h-12 w-12" />
          </Button>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 text-center z-30">
          <h2 className="text-6xl font-headline font-bold text-destructive mb-2 tracking-tighter">WASTED</h2>
          <p className="text-3xl text-white font-headline font-bold mb-8">Score: {Math.floor(score / 10)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold">
            <RotateCcw className="mr-3 h-8 w-8" /> RESTART
          </Button>
        </div>
      )}
    </div>
  );
}
