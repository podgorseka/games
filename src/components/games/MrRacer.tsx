
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Pause, User, Zap } from 'lucide-react';

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
  const traffic = useRef<{ x: number, z: number, speed: number, color: string, type: 'car' | 'truck', id: number }[]>([]);
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
    if (traffic.current.length > 3) return; // Moins de voitures pour plus de clarté
    const lanes = [-160, -60, 60, 160];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    
    if (traffic.current.some(t => Math.abs(t.z - 6000) < 1500 && t.x === laneX)) return;

    const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#4b5563', '#ffffff', '#000000'];
    traffic.current.push({
      id: Math.random(),
      x: laneX,
      z: 6000 + Math.random() * 2000,
      speed: 0.02 + Math.random() * 0.04,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.85 ? 'truck' : 'car'
    });
  }, []);

  const spawnEnv = (zPos: number) => {
    environment.current.push({ x: -600, z: zPos, type: 'building_left' });
    environment.current.push({ x: 600, z: zPos, type: 'building_right' });
    if (zPos % 800 === 0) {
      environment.current.push({ x: -350, z: zPos, type: 'lamp' });
      environment.current.push({ x: 350, z: zPos, type: 'lamp' });
    }
  };

  const update = useCallback(() => {
    if (gameOver) return;

    // Movement
    if (keys.current['LeftPress']) targetX.current -= 15;
    if (keys.current['RightPress']) targetX.current += 15;
    targetX.current = Math.max(-240, Math.min(240, targetX.current));
    playerX.current += (targetX.current - playerX.current) * 0.12;

    // Speed mechanics
    if (keys.current['Accel']) targetSpeed.current = Math.min(0.55, targetSpeed.current + 0.006);
    else if (keys.current['Brake']) targetSpeed.current = Math.max(0, targetSpeed.current - 0.02);
    else targetSpeed.current = Math.max(0.05, targetSpeed.current - 0.003);

    playerSpeed.current += (targetSpeed.current - playerSpeed.current) * 0.08;
    const currentKph = Math.floor(playerSpeed.current * 495);
    setSpeedKph(currentKph);
    
    const distInc = playerSpeed.current * 0.01;
    setDistance(d => d + distInc);
    roadOffset.current = (roadOffset.current + playerSpeed.current * 300) % 1000;

    // Traffic update
    if (Math.random() < 0.015) spawnTraffic();
    traffic.current.forEach(car => {
      const relSpeed = (playerSpeed.current - car.speed) * 200;
      car.z -= relSpeed;

      // Real 3D collision check
      const carWidth = car.type === 'truck' ? 130 : 100;
      if (car.z > -15 && car.z < 115) {
        const dx = Math.abs(car.x - playerX.current);
        if (dx < carWidth - 30) {
          setGameOver(true);
        }
      }
    });
    traffic.current = traffic.current.filter(c => c.z > -2000 && c.z < 8500);

    // Environment update
    environment.current.forEach(env => {
      env.z -= playerSpeed.current * 300;
      if (env.z < -800) env.z += 8000;
    });

    setScore(s => s + Math.floor(playerSpeed.current * 20));
  }, [gameOver, spawnTraffic]);

  const drawVehicle = (ctx: CanvasRenderingContext2D, x: number, z: number, color: string, isPlayer: boolean = false, type: 'car' | 'truck' = 'car') => {
    const scale = FOV / (FOV + z);
    const screenX = CANVAS_WIDTH / 2 + (x - (isPlayer ? 0 : playerX.current)) * scale * 4.5;
    const screenY = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
    
    if (screenY < HORIZON || scale < 0.01) return;

    const vW = (type === 'truck' ? 280 : 200) * scale;
    const vH = (type === 'truck' ? 260 : 160) * scale;
    const roofY = screenY - vH;

    ctx.save();
    
    // Shadow
    const shadowGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, vW * 0.8);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
    shadowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, vW * 0.8, vH * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(screenX - vW / 2, roofY, vW, vH, 10 * scale);
    ctx.fill();

    // Reflections and Volume
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(screenX - vW/2, roofY, vW * 0.2, vH);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(screenX + vW/2 - vW*0.2, roofY, vW * 0.2, vH);

    // Rear Windows
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(screenX - vW * 0.38, roofY + vH * 0.1, vW * 0.76, vH * 0.42, 4 * scale);
    ctx.fill();

    // Lights Bloom
    ctx.shadowBlur = 25 * scale;
    ctx.shadowColor = '#ef4444';
    ctx.fillStyle = isPlayer ? '#f87171' : '#991b1b';
    
    const lightW = vW * 0.3;
    const lightH = vH * 0.15;
    const lightY = roofY + vH * 0.65;
    
    ctx.beginPath();
    ctx.roundRect(screenX - vW * 0.44, lightY, lightW, lightH, 3 * scale);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(screenX + vW * 0.44 - lightW, lightY, lightW, lightH, 3 * scale);
    ctx.fill();
    
    ctx.restore();
  };

  const drawEnvironment = (ctx: CanvasRenderingContext2D) => {
    environment.current.sort((a, b) => b.z - a.z).forEach(env => {
      const scale = FOV / (FOV + env.z);
      const x = CANVAS_WIDTH / 2 + (env.x - playerX.current) * scale * 4.5;
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * scale;
      
      if (y < HORIZON) return;

      if (env.type.startsWith('building')) {
        const bW = 800 * scale;
        const bH = 2000 * scale;
        ctx.fillStyle = env.type.includes('left') ? '#0f172a' : '#1e293b';
        ctx.fillRect(x - bW / 2, y - bH, bW, bH);
        
        ctx.fillStyle = 'rgba(254,240,138,0.1)';
        for (let r = 0; r < 15; r++) {
          for (let c = 0; c < 4; c++) {
            if (Math.sin(env.z + r + c) > 0.5) {
              ctx.fillRect(x - bW/2 + 20*scale + c*180*scale, y - bH + 50*scale + r*130*scale, 120*scale, 80*scale);
            }
          }
        }
      } else if (env.type === 'lamp') {
        const lH = 500 * scale;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 8 * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - lH);
        ctx.lineTo(x + (env.x < 0 ? 120 : -120) * scale, y - lH);
        ctx.stroke();
        
        const lx = x + (env.x < 0 ? 120 : -120) * scale;
        const ly = y - lH;
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 180 * scale);
        grad.addColorStop(0, 'rgba(254,240,138,0.4)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, 180 * scale, 0, Math.PI * 2);
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

    // Road Surface
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Reflections
    const reflections = ctx.createLinearGradient(0, HORIZON, 0, CANVAS_HEIGHT);
    reflections.addColorStop(0, 'rgba(30,58,138,0.3)');
    reflections.addColorStop(1, 'transparent');
    ctx.fillStyle = reflections;
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, 100);

    // Lane Markings
    for (let i = 0; i < 22; i++) {
      const z = i * 300 - roadOffset.current;
      if (z < 0) continue;
      const s = FOV / (FOV + z);
      const y = HORIZON + (CANVAS_HEIGHT - HORIZON) * s;
      const h = 200 * s;
      const w = 24 * s;

      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      [-120, 0, 120].forEach(lx => {
        const x = CANVAS_WIDTH / 2 + (lx * s * 5) - (playerX.current * s * 4.5);
        ctx.fillRect(x - w / 2, y, w, h);
      });
    }

    drawEnvironment(ctx);

    const allVehicles = [
      ...traffic.current.map(c => ({ ...c, isPlayer: false })),
      { x: playerX.current, z: 80, speed: 0, color: '#0f172a', type: 'car' as const, isPlayer: true, id: 0 }
    ].sort((a, b) => b.z - a.z);

    allVehicles.forEach(v => drawVehicle(ctx, v.x, v.z, v.color, v.isPlayer, v.type));

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
      {/* PROFESSIONAL RACING HUD */}
      <div className="absolute top-6 left-6 flex flex-col gap-4 z-20 pointer-events-none">
        <div className="flex items-center gap-3">
           <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
             <Pause className="text-white h-5 w-5" />
           </div>
           <div className="bg-yellow-400 px-4 py-1.5 rounded-lg text-black font-black text-sm italic tracking-tighter shadow-xl border-b-4 border-yellow-600">
             RACE 1
           </div>
        </div>
        <div className="space-y-2 mt-2">
           <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border-l-4 border-slate-400 flex items-center gap-3 shadow-lg">
             <div className="h-7 w-7 bg-slate-800 rounded-full flex items-center justify-center border border-white/10"><User className="h-4 w-4 text-slate-300" /></div>
             <span className="text-white text-[11px] font-bold uppercase tracking-widest opacity-80">RIVAL_01</span>
           </div>
           <div className="bg-yellow-400/90 backdrop-blur-md px-4 py-2 rounded-xl border-l-4 border-yellow-700 flex items-center gap-3 shadow-xl">
             <div className="h-7 w-7 bg-yellow-600 rounded-full flex items-center justify-center border border-yellow-300"><User className="h-4 w-4 text-white" /></div>
             <span className="text-black text-[11px] font-black uppercase tracking-widest italic">YOU</span>
           </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 text-right z-20 pointer-events-none space-y-3">
        <div className="bg-white/10 backdrop-blur-2xl px-6 py-4 rounded-2xl border border-white/20 shadow-2xl flex flex-col items-end">
          <div className="text-[10px] font-black uppercase leading-none text-yellow-400 tracking-widest mb-1">KPH</div>
          <div className="text-5xl font-black italic text-white tracking-tighter leading-none">{speedKph}</div>
        </div>
        <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/5 flex items-center gap-2">
          <Zap className="h-3 w-3 text-yellow-400 fill-current" />
          <span className="text-white/80 text-[11px] font-black uppercase tracking-widest">
            Dist: {distance.toFixed(1)} KM
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} width={800} height={450} className="w-full h-auto max-h-screen shadow-2xl" />

      {/* PEDALS */}
      {!gameOver && (
        <div className="absolute bottom-8 inset-x-8 flex justify-between z-30">
          <div 
            className="w-24 h-40 bg-white/5 backdrop-blur-md border-2 border-white/10 rounded-3xl flex flex-col items-center justify-center cursor-pointer active:bg-red-500/20 transition-all active:scale-95 shadow-2xl"
            onPointerDown={() => keys.current['Brake'] = true}
            onPointerUp={() => keys.current['Brake'] = false}
          >
            <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">Brake</div>
            <div className="w-16 h-4 bg-white/10 rounded-full border border-white/20" />
          </div>

          <div 
            className="w-24 h-48 bg-white/5 backdrop-blur-md border-2 border-white/10 rounded-3xl flex flex-col items-center justify-center cursor-pointer active:bg-yellow-400/20 transition-all active:scale-95 shadow-2xl"
            onPointerDown={() => keys.current['Accel'] = true}
            onPointerUp={() => keys.current['Accel'] = false}
          >
            <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">Accel</div>
            <div className="w-12 h-32 bg-yellow-400/10 rounded-2xl border border-yellow-400/30" />
          </div>
        </div>
      )}

      {!gameOver && (
        <div className="absolute inset-0 z-10 flex">
          <div className="flex-1" onPointerDown={() => keys.current['LeftPress'] = true} onPointerUp={() => keys.current['LeftPress'] = false} />
          <div className="flex-1" onPointerDown={() => keys.current['RightPress'] = true} onPointerUp={() => keys.current['RightPress'] = false} />
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <h2 className="text-8xl font-black text-red-600 mb-6 tracking-tighter italic">WASTED</h2>
          <p className="text-2xl text-white/60 mb-12">DISTANCE: {distance.toFixed(2)} KM</p>
          <Button onClick={initGame} size="lg" className="rounded-2xl px-20 py-12 text-3xl font-black bg-yellow-400 text-black shadow-2xl border-b-8 border-yellow-600 italic">
            RESTART RACE
          </Button>
        </div>
      )}
    </div>
  );
}

