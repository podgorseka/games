
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
  
  // 3D Perspective settings
  const HORIZON = CANVAS_HEIGHT * 0.45;
  const FOV = 100;
  
  // Game state
  const playerX = useRef(0); // -100 to 100
  const enemies = useRef<{ x: number, z: number, speed: number, color: string }[]>([]);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameSpeed = useRef(0.05);

  const initGame = useCallback(() => {
    playerX.current = 0;
    enemies.current = [];
    roadOffset.current = 0;
    gameSpeed.current = 0.05;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    const laneX = (Math.floor(Math.random() * 3) - 1) * 60; // -60, 0, 60
    const colors = ['#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D', '#000000'];
    enemies.current.push({
      x: laneX,
      z: 500, // Distance in "meters"
      speed: 1.5 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;

    // Movement
    if (keys.current['ArrowLeft'] || keys.current['a']) playerX.current -= 4;
    if (keys.current['ArrowRight'] || keys.current['d']) playerX.current += 4;

    // Boundary check
    playerX.current = Math.max(-110, Math.min(110, playerX.current));

    // Road scroll
    roadOffset.current = (roadOffset.current + gameSpeed.current * 20) % 100;

    // Increase difficulty
    gameSpeed.current += 0.00005;
    setScore(s => s + 1);

    // Spawn enemies
    if (Math.random() < 0.02) spawnEnemy();
    
    // Update enemies
    enemies.current.forEach(e => {
      e.z -= (gameSpeed.current * 100) + e.speed;

      // Collision detection (roughly when Z is close to player Z=0)
      if (e.z > -10 && e.z < 20) {
        const dist = Math.abs(e.x - playerX.current);
        if (dist < 40) {
          setGameOver(true);
        }
      }
    });

    enemies.current = enemies.current.filter(e => e.z > -50);
  }, [gameOver, spawnEnemy]);

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false) => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON) return;

    const carW = 60 * scale;
    const carH = 40 * scale;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, carH * 0.8, carW * 0.6, carH * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-carW/2, -carH, carW, carH, 5 * scale);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    // Cabin
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(-carW/3, -carH * 0.9, (carW/3)*2, carH * 0.4);

    // Lights
    ctx.fillStyle = isPlayer ? 'red' : 'yellow';
    ctx.fillRect(-carW/2 + 2, -carH * 0.2, 5 * scale, 3 * scale);
    ctx.fillRect(carW/2 - 7, -carH * 0.2, 5 * scale, 3 * scale);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#1a1a2e');
    skyGrad.addColorStop(1, '#16213e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Ground / Road
    ctx.fillStyle = '#222';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Road Lines Perspective
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    for (let i = 0; i < 50; i++) {
      const z = i * 20 - roadOffset.current;
      if (z < 0) continue;
      const scale = FOV / (FOV + z);
      const nextScale = FOV / (FOV + z + 10);
      
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      if (y > CANVAS_HEIGHT) continue;

      // Draw dashed lane markings
      ctx.beginPath();
      const laneWidth = 150 * scale;
      const xLeft = CANVAS_WIDTH / 2 - laneWidth - (playerX.current * scale);
      const xRight = CANVAS_WIDTH / 2 + laneWidth - (playerX.current * scale);
      
      ctx.moveTo(xLeft, y); ctx.lineTo(xLeft, y + 2);
      ctx.moveTo(xRight, y); ctx.lineTo(xRight, y + 2);
      ctx.stroke();
    }

    // Enemies (draw back to front)
    enemies.current.sort((a, b) => b.z - a.z).forEach(e => drawCar(ctx, e.x, e.z, e.color));

    // Player (static screen position for pseudo-3D feel, or slightly reactive)
    drawCar(ctx, playerX.current, 15, '#C41DFA', true);

    // HUD
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Space Grotesk';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'black';
    ctx.fillText(`${Math.floor(score / 10)} KM`, 20, 40);
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
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 overflow-hidden touch-none">
      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[85vh] shadow-2xl" />
      
      {isMobile && !gameOver && (
        <div className="absolute bottom-12 left-0 right-0 flex justify-around px-8 pointer-events-auto">
          <Button 
            className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border-4 border-white/20 active:scale-90 transition-transform"
            onPointerDown={() => handleMobilePress('left', true)}
            onPointerUp={() => handleMobilePress('left', false)}
          >
            <ArrowLeft className="h-10 w-10" />
          </Button>
          <Button 
            className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border-4 border-white/20 active:scale-90 transition-transform"
            onPointerDown={() => handleMobilePress('right', true)}
            onPointerUp={() => handleMobilePress('right', false)}
          >
            <ArrowRight className="h-10 w-10" />
          </Button>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 text-center z-30">
          <h2 className="text-7xl font-headline font-bold text-destructive mb-4 tracking-tighter italic">CRASHED</h2>
          <p className="text-3xl text-white font-headline font-bold mb-10">{Math.floor(score / 10)} KM TRAVELED</p>
          <Button onClick={initGame} size="lg" className="rounded-full px-12 py-8 text-2xl font-bold bg-primary hover:bg-primary/80">
            <RotateCcw className="mr-3 h-8 w-8" /> RESTART RACE
          </Button>
        </div>
      )}
    </div>
  );
}
