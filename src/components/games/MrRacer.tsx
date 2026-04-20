
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Pause, User } from 'lucide-react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450;
const HORIZON = CANVAS_HEIGHT * 0.45;
const FOV = 100;

export default function MrRacer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [speedKph, setSpeedKph] = useState(0);
  const [distance, setDistance] = useState(0);
  const gameLoopRef = useRef<number>(0);

  // Game State
  const playerX = useRef(0);
  const targetX = useRef(0);
  const playerSpeed = useRef(0);
  const targetSpeed = useRef(0);
  const roadOffset = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const traffic = useRef<{ x: number, z: number, speed: number, color: string, type: 'car' | 'truck' }[]>([]);
  const environment = useRef<{ x: number, z: number, type: 'building_left' | 'building_right' | 'lamp' }[]>([]);

  const initGame = useCallback(() => {
    playerX.current = 0;
    targetX.current = 0;
    playerSpeed.current = 0.05;
    targetSpeed.current = 0.05;
    roadOffset.current = 0;
    traffic.current = [];
    environment.current = [];
    setScore(0);
    setDistance(0);
    setGameOver(false);

    // Initial environment
    for (let i = 0; i < 20; i++) {
      spawnEnv(i * 400);
    }
  }, []);

  const spawnTraffic = useCallback(() => {
    if (traffic.current.length > 3) return;
    const lanes = [-160, -60, 60, 160];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#4b5563'];
    traffic.current.push({
      x: laneX,
      z: 4000 + Math.random() * 2000,
      speed: 0.02 + Math.random() * 0.04,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.85 ? 'truck' : 'car'
    });
  }, []);

  const spawnEnv = (zPos: number) => {
    environment.current.push({ x: -450, z: zPos, type: 'building_left' });
    environment.current.push({ x: 450, z: zPos, type: 'building_right' });
    if (zPos % 800 === 0) {
      environment.current.push({ x: -280, z: zPos, type: 'lamp' });
      environment.current.push({ x: 280, z: zPos, type: 'lamp' });
    }
  };

  const update = useCallback(() => {
    if (gameOver) return;

    // Movement
    if (keys.current['LeftPress']) targetX.current -= 15;
    if (keys.current['RightPress']) targetX.current += 15;
    targetX.current = Math.max(-220, Math.min(220, targetX.current));
    playerX.current += (targetX.current - playerX.current) * 0.12;

    // Speed
    if (keys.current['Accel']) targetSpeed.current = Math.min(0.4, targetSpeed.current + 0.004);
    else if (keys.current['Brake']) targetSpeed.current = Math.max(0, targetSpeed.current - 0.012);
    else targetSpeed.current = Math.max(0.05, targetSpeed.current - 0.002);

    playerSpeed.current += (targetSpeed.current - playerSpeed.current) * 0.08;
    const currentKph = Math.floor(playerSpeed.current * 480);
    setSpeedKph(currentKph);
    
    const distInc = playerSpeed.current * 0.01;
    setDistance(d => d + distInc);
    roadOffset.current = (roadOffset.current + playerSpeed.current * 250) % 1000;

    // Traffic update
    if (Math.random() < 0.012) spawnTraffic();
    traffic.current.forEach(car => {
      const relSpeed = (playerSpeed.current - car.speed) * 200;
      car.z -= relSpeed;

      // Real collision check based on volume
      const carWidth = car.type === 'truck' ? 120 : 90;
      if (car.z > -20 && car.z < 100) {
        if (Math.abs(car.x - playerX.current) < carWidth - 15) {
          setGameOver(true);
        }
      }
    });
    traffic.current = traffic.current.filter(c => c.z > -1000 && c.z < 8000);

    // Env update
    environment.current.forEach(env => {
      env.z -= playerSpeed.current * 250;
      if (env.z < -500) {
        env.z += 8000;
      }
    });

    setScore(s => s + Math.floor(playerSpeed.current * 10));
  }, [gameOver, spawnTraffic]);

  const drawVehicle = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: 'car' | 'truck' = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 4.5;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.01) return;

    const vW = (type === 'truck' ? 240 : 180) * scale;
    const vH = (type === 'truck' ? 220 : 140) * scale;
    const roofY = screenY - vH;

    ctx.save();
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, vW * 0.7, vH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(screenX - vW / 2, roofY, vW, vH, 15 * scale);
    ctx.fill();

    // Rear Window
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(screenX - vW * 0.4, roofY + vH * 0.15, vW * 0.8, vH * 0.4, 8 * scale);
    ctx.fill();

    // Rear Lights (Bloom effect)
    const lightW = vW * 0.3;
    const lightH = vH * 0.15;
    const lightY = roofY + vH * 0.65;
    
    ctx.shadowBlur = 25 * scale;
    ctx.shadowColor = '#ff0000';
    ctx.fillStyle = isPlayer ? '#ff3333' : '#aa0000';
    
    if (isPlayer) {
      // Modern LED bar
      ctx.beginPath();
      ctx.roundRect(screenX - vW * 0.45, lightY, vW * 0.9, vH * 0.08, 5 * scale);
      ctx.fill();
    } else {
      ctx.fillRect(screenX - vW * 0.45, lightY, lightW, lightH);
      ctx.fillRect(screenX + vW * 0.45 - lightW, lightY, lightW, lightH);
    }
    
    // License Plate
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white';
    ctx.fillRect(screenX - vW * 0.15, roofY + vH * 0.75, vW * 0.3, vH * 0.15);
    ctx.fillStyle = 'black';
    ctx.font = `${Math.floor(10 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(isPlayer ? "MR RACER" : "TRAFFIC", screenX, roofY + vH * 0.87);

    ctx.restore();
  };

  const drawEnvironment = (ctx: CanvasRenderingContext2D) => {
    environment.current.sort((a, b) => b.z - a.z).forEach(env => {
      const scale = FOV / (FOV + env.z);
      const x = CANVAS_WIDTH / 2 + (env.x - playerX.current) * scale * 4.5;
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      
      if (y < HORIZON) return;

      if (env.type.startsWith('building')) {
        const bW = 600 * scale;
        const bH = 1200 * scale;
        ctx.fillStyle = env.type.includes('left') ? '#334155' : '#475569';
        ctx.fillRect(x - bW / 2, y - bH, bW, bH);
        
        // Windows
        ctx.fillStyle = 'rgba(255,255,100,0.1)';
        for (let row = 0; row < 10; row++) {
          for (let col = 0; col < 4; col++) {
            if (Math.random() > 0.3) {
              ctx.fillRect(x - bW/2 + 20*scale + col*140*scale, y - bH + 50*scale + row*100*scale, 80*scale, 60*scale);
            }
          }
        }
      } else if (env.type === 'lamp') {
        const lH = 400 * scale;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 8 * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - lH);
        ctx.lineTo(x + (env.x < 0 ? 80 : -80) * scale, y - lH);
        ctx.stroke();
        
        // Light glow
        const lx = x + (env.x < 0 ? 80 : -80) * scale;
        const ly = y - lH;
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 100 * scale);
        grad.addColorStop(0, 'rgba(255,255,200,0.6)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, 100 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Ground (Wet Road)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Fog
    const fog = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 200);
    fog.addColorStop(0, '#1e293b');
    fog.addColorStop(1, 'transparent');
    ctx.fillStyle = fog;
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, 200);

    // Lane Markings
    for (let i = 0; i < 20; i++) {
      const z = i * 250 - roadOffset.current;
      if (z < 0) continue;
      const s = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * s;
      const h = 120 * s;
      const w = 15 * s;

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      [-110, 0, 110].forEach(lx => {
        const x = CANVAS_WIDTH / 2 + (lx * s * 5) - (playerX.current * s * 4.5);
        ctx.fillRect(x - w / 2, y, w, h);
      });
    }

    drawEnvironment(ctx);

    // Vehicles sorted by distance
    const all = [
      ...traffic.current.map(c => ({ ...c, isPlayer: false })),
      { x: playerX.current, z: 60, speed: 0, color: '#000000', type: 'car' as const, isPlayer: true }
    ].sort((a, b) => b.z - a.z);

    all.forEach(v => drawVehicle(ctx, v.x, v.z, v.color, v.isPlayer, v.type));

  }, [roadOffset.current]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  useEffect(() => {
    initGame();
    const handleDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current['LeftPress'] = true;
      if (e.key === 'ArrowRight') keys.current['RightPress'] = true;
      if (e.key === 'ArrowUp') keys.current['Accel'] = true;
      if (e.key === 'ArrowDown') keys.current['Brake'] = true;
    };
    const handleUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current['LeftPress'] = false;
      if (e.key === 'ArrowRight') keys.current['RightPress'] = false;
      if (e.key === 'ArrowUp') keys.current['Accel'] = false;
      if (e.key === 'ArrowDown') keys.current['Brake'] = false;
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, [initGame]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#020617] overflow-hidden touch-none select-none">
      {/* REALISTIC HUD */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-20 pointer-events-none">
        <div className="flex items-center gap-2">
           <div className="bg-black/50 p-2 rounded-lg backdrop-blur-md">
             <Pause className="text-white h-5 w-5" />
           </div>
           <div className="bg-yellow-400 px-3 py-1 rounded text-black font-black text-sm italic">RACE 1</div>
        </div>
        <div className="space-y-1 mt-2">
           <div className="bg-black/40 px-3 py-1 rounded border-l-4 border-slate-400 flex items-center gap-2">
             <div className="h-6 w-6 bg-slate-800 rounded-full flex items-center justify-center"><User className="h-4 w-4 text-white" /></div>
             <span className="text-white text-xs font-bold uppercase tracking-tighter">Mamba</span>
           </div>
           <div className="bg-yellow-400/80 px-3 py-1 rounded border-l-4 border-yellow-600 flex items-center gap-2">
             <div className="h-6 w-6 bg-yellow-600 rounded-full flex items-center justify-center"><User className="h-4 w-4 text-white" /></div>
             <span className="text-black text-xs font-bold uppercase tracking-tighter italic">You</span>
           </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 text-right z-20 pointer-events-none space-y-1">
        <div className="bg-yellow-400/90 px-4 py-2 rounded-lg backdrop-blur-md">
          <div className="text-[10px] text-black font-bold uppercase leading-none">Gear</div>
          <div className="text-2xl text-black font-black italic">3/7</div>
        </div>
        <div className="bg-black/40 px-4 py-2 rounded-lg backdrop-blur-md text-white border border-white/10">
          <div className="text-[10px] font-bold uppercase leading-none opacity-60">KPH</div>
          <div className="text-3xl font-black italic tracking-tighter">{speedKph}</div>
        </div>
        <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest pt-1">
          Distance {distance.toFixed(1)}/2.0 KM
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-10">
        <span className="text-[200px] font-black italic text-yellow-400">1</span>
      </div>

      <canvas ref={canvasRef} width={800} height={450} className="w-full h-auto max-h-screen shadow-2xl" />

      {/* PEDALS */}
      {!gameOver && (
        <div className="absolute bottom-6 inset-x-6 flex justify-between z-30">
          <div 
            className="w-24 h-36 bg-black/60 border-2 border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer active:bg-red-900/40 transition-all active:scale-95"
            onPointerDown={() => keys.current['Brake'] = true}
            onPointerUp={() => keys.current['Brake'] = false}
            onPointerLeave={() => keys.current['Brake'] = false}
          >
            <div className="text-white/30 text-[10px] font-black uppercase mb-4">Brake</div>
            <div className="w-16 h-4 bg-white/20 rounded-full" />
            <div className="w-16 h-2 bg-white/10 rounded-full mt-2" />
          </div>

          <div 
            className="w-24 h-44 bg-black/60 border-2 border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer active:bg-yellow-500/40 transition-all active:scale-95"
            onPointerDown={() => keys.current['Accel'] = true}
            onPointerUp={() => keys.current['Accel'] = false}
            onPointerLeave={() => keys.current['Accel'] = false}
          >
            <div className="text-white/30 text-[10px] font-black uppercase mb-4">Accel</div>
            <div className="w-10 h-28 bg-yellow-400/20 rounded-xl border border-yellow-400/30" />
          </div>
        </div>
      )}

      {/* OVERLAY CONTROLS (Steering) */}
      {!gameOver && (
        <div className="absolute inset-0 z-10 flex">
          <div className="flex-1" onPointerDown={() => keys.current['LeftPress'] = true} onPointerUp={() => keys.current['LeftPress'] = false} />
          <div className="flex-1" onPointerDown={() => keys.current['RightPress'] = true} onPointerUp={() => keys.current['RightPress'] = false} />
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-8xl font-black text-red-600 mb-8 tracking-tighter italic drop-shadow-2xl">COLLISION</h2>
          <p className="text-3xl text-white/80 mb-12 font-bold tracking-widest uppercase">Distance: {distance.toFixed(2)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-20 py-14 text-4xl font-black bg-yellow-400 text-black hover:scale-110 transition-transform shadow-2xl border-b-8 border-yellow-600 italic">
            TRY AGAIN
          </Button>
        </div>
      )}
    </div>
  );
}
