
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function SubwaySurfer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const gameLoopRef = useRef<number>(0);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 600;
  const HORIZON = CANVAS_HEIGHT * 0.42;
  const FOV = 110; // FOV plus large pour voir plus loin
  const TRAIN_HEIGHT = 70;

  const playerLane = useRef(1);
  const currentX = useRef(0);
  const playerYOffset = useRef(0);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const jumpVelocity = useRef(0);
  const obstacles = useRef<{ lane: number, z: number, length: number, type: 'train' | 'barrier' | 'ramp', climbable: boolean, color: string }[]>([]);
  const coinsList = useRef<{ lane: number, z: number }[]>([]);
  const gameSpeed = useRef(3.8); // Ralenti un peu
  const frameCount = useRef(0);

  const initGame = useCallback(() => {
    playerLane.current = 1;
    currentX.current = 0;
    playerYOffset.current = 0;
    isJumping.current = false;
    isSliding.current = false;
    obstacles.current = [];
    coinsList.current = [];
    gameSpeed.current = 3.8;
    frameCount.current = 0;
    setScore(0);
    setCoins(0);
    setGameOver(false);
  }, []);

  const moveLane = (dir: number) => {
    if (gameOver) return;
    const nextLane = playerLane.current + dir;
    if (nextLane >= 0 && nextLane < 3) playerLane.current = nextLane;
  };

  const jump = () => {
    if (gameOver || isJumping.current) return;
    isJumping.current = true;
    jumpVelocity.current = 15;
    isSliding.current = false;
  };

  const slide = () => {
    if (gameOver || isSliding.current) return;
    isSliding.current = true;
    setTimeout(() => isSliding.current = false, 750);
  };

  const update = useCallback(() => {
    if (gameOver) return;

    frameCount.current++;
    setScore(s => s + 1);

    const targetX = (playerLane.current - 1) * 120;
    currentX.current += (targetX - currentX.current) * 0.18; // Transition plus fluide

    playerYOffset.current += jumpVelocity.current;
    jumpVelocity.current -= 0.85;

    let onTrain = false;
    obstacles.current.forEach(obs => {
      if (obs.type === 'train' || obs.type === 'ramp') {
        if (playerLane.current === obs.lane && obs.z < 60 && (obs.z + obs.length) > 20) {
           if (playerYOffset.current >= TRAIN_HEIGHT - 10) {
             onTrain = true;
           }
        }
      }
    });

    const floorY = onTrain ? TRAIN_HEIGHT : 0;
    if (playerYOffset.current <= floorY) {
      playerYOffset.current = floorY;
      jumpVelocity.current = 0;
      isJumping.current = false;
    }

    // Spawn plus intelligent et plus espacé
    if (frameCount.current % 90 === 0) {
      const lane = Math.floor(Math.random() * 3);
      const isClimbable = Math.random() > 0.65;
      obstacles.current.push({ 
        lane, 
        z: 1500, // Spawn plus loin
        length: isClimbable ? 350 : 700 + Math.random() * 800, 
        type: isClimbable ? 'ramp' : 'train',
        climbable: isClimbable,
        color: isClimbable ? '#2563eb' : '#1e293b' // Bleu pour les montables, noir pour les autres
      });
    } else if (frameCount.current % 130 === 0) {
      obstacles.current.push({ lane: Math.floor(Math.random() * 3), z: 1500, length: 45, type: 'barrier', climbable: false, color: '#dc2626' });
    }

    if (frameCount.current % 45 === 0) coinsList.current.push({ lane: Math.floor(Math.random() * 3), z: 1500 });

    gameSpeed.current += 0.0008;

    obstacles.current.forEach(obj => {
      obj.z -= gameSpeed.current * 7.5;
      if (obj.lane === playerLane.current && obj.z < 45 && (obj.z + obj.length) > 25) {
        if (obj.type === 'ramp' && playerYOffset.current < TRAIN_HEIGHT) {
           playerYOffset.current += (TRAIN_HEIGHT - playerYOffset.current) * 0.35;
        } else if (obj.type === 'train' && playerYOffset.current < TRAIN_HEIGHT - 20) {
           setGameOver(true);
        } else if (obj.type === 'barrier' && !isSliding.current && playerYOffset.current < 45) {
           setGameOver(true);
        }
      }
    });

    coinsList.current.forEach(c => {
      c.z -= gameSpeed.current * 7.5;
      if (c.lane === playerLane.current && c.z > 20 && c.z < 65) {
        const charY = playerYOffset.current;
        if (Math.abs(charY - 0) < 55 || Math.abs(charY - TRAIN_HEIGHT) < 55) {
           setCoins(prev => prev + 1);
           c.z = -1000; // Reculé loin pour éviter de repasser dessus
        }
      }
    });

    obstacles.current = obstacles.current.filter(o => (o.z + o.length) > -200);
    coinsList.current = coinsList.current.filter(c => c.z > -200);
  }, [gameOver]);

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bodyH = isSliding.current ? 35 : 65;
    
    // Ombre personnage
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Corps articulé
    ctx.fillStyle = '#C41DFA';
    ctx.beginPath(); ctx.roundRect(-20, -bodyH - 25, 40, bodyH, 18); ctx.fill();
    
    // Tête
    ctx.fillStyle = '#fdb';
    ctx.beginPath(); ctx.arc(0, -bodyH - 45, 18, 0, Math.PI * 2); ctx.fill();
    
    // Casquette stylée
    ctx.fillStyle = '#FA1D64';
    ctx.beginPath(); ctx.roundRect(-18, -bodyH - 62, 36, 14, 6); ctx.fill();
    ctx.fillRect(5, -bodyH - 62, 28, 6);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Environnement profond
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#020617'); sky.addColorStop(0.8, '#1e1b4b'); sky.addColorStop(1, '#2e1065');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON);

    // Sol béton sombre
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, HORIZON, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON);

    // Rails détaillés
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
    for (let i = 0; i <= 3; i++) {
      const laneX = (i - 1.5) * 140;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH/2, HORIZON);
      ctx.lineTo(CANVAS_WIDTH/2 + laneX * 18, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Objets (fond vers avant)
    const all = [
      ...obstacles.current.map(o => ({...o, isObs: true})),
      ...coinsList.current.map(c => ({...c, isObs: false, length: 0, type: 'coin', color: '#FAC11D', climbable: false}))
    ].sort((a, b) => b.z - a.z);

    all.forEach(obj => {
      const scaleS = FOV / (FOV + obj.z);
      const scaleE = FOV / (FOV + obj.z + obj.length);
      const laneX = (obj.lane - 1) * 140;
      
      const xS = CANVAS_WIDTH / 2 + laneX * scaleS * 4;
      const xE = CANVAS_WIDTH / 2 + laneX * scaleE * 4;
      const yS = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleS;
      const yE = HORIZON + (CANVAS_HEIGHT - HORIZON) * scaleE;

      if (obj.type === 'train' || obj.type === 'ramp') {
        const wS = 130 * scaleS; const wE = 130 * scaleE;
        const hS = TRAIN_HEIGHT * scaleS; const hE = TRAIN_HEIGHT * scaleE;

        // Corps du train
        const grad = ctx.createLinearGradient(xS, yS, xS, yS - hS);
        grad.addColorStop(0, obj.color);
        grad.addColorStop(1, obj.climbable ? '#60a5fa' : '#334155');
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS); ctx.lineTo(xE - wE/2, yE);
        ctx.lineTo(xE + wE/2, yE); ctx.lineTo(xS + wS/2, yS);
        ctx.fill();
        
        // Toit avec effet de lumière
        ctx.fillStyle = obj.climbable ? '#3b82f6' : '#1e293b';
        ctx.beginPath();
        ctx.moveTo(xS - wS/2, yS - hS); ctx.lineTo(xE - wE/2, yE - hE);
        ctx.lineTo(xE + wE/2, yE - hE); ctx.lineTo(xS + wS/2, yS - hS);
        ctx.fill();

        // Si c'est une rampe, on ajoute un indicateur visuel fort
        if (obj.type === 'ramp') {
           ctx.fillStyle = 'rgba(255,255,255,0.4)';
           ctx.beginPath();
           ctx.moveTo(xS - wS/2.5, yS); ctx.lineTo(xS, yS - hS); ctx.lineTo(xS + wS/2.5, yS);
           ctx.fill();
        }

        // Fenêtres de train
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        for(let i=1; i<4; i++) {
           const winZ = obj.z + (obj.length / 4) * i;
           const winScale = FOV / (FOV + winZ);
           const winX = CANVAS_WIDTH / 2 + laneX * winScale * 4;
           const winY = HORIZON + (CANVAS_HEIGHT - HORIZON) * winScale;
           ctx.fillRect(winX - (wS/3), winY - (hS*0.7), wS/1.5, hS/3);
        }
      } else if (obj.type === 'barrier') {
        const bW = 110 * scaleS; const bH = 55 * scaleS;
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(xS - bW/2, yS - bH, bW, bH);
        ctx.fillStyle = 'white';
        ctx.fillRect(xS - bW/2, yS - (bH*0.6), bW, 6 * scaleS);
      } else if (obj.type === 'coin') {
        const cs = 45 * scaleS;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 15; ctx.shadowColor = '#fbbf24';
        ctx.beginPath(); ctx.arc(xS, yS - 40 * scaleS, cs/2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Personnage caméra
    const pScale = FOV / (FOV + 50);
    const px = CANVAS_WIDTH / 2 + currentX.current * pScale * 1.5;
    const py = (HORIZON + (CANVAS_HEIGHT - HORIZON) * pScale) - playerYOffset.current * pScale;
    drawCharacter(ctx, px, py, pScale * 2.1);

  }, [score, coins, isSliding]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => { update(); draw(ctx); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

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

  useEffect(() => { if (gameOver) onGameOver(Math.floor(score / 10) + coins * 10); }, [gameOver, score, coins, onGameOver]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden touch-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="absolute top-10 left-10 flex flex-col items-start gap-1 z-20 pointer-events-none">
          <div className="text-6xl font-headline font-bold text-white italic tracking-tighter drop-shadow-lg">
             {Math.floor(score / 10)}<span className="text-xl text-primary ml-1 uppercase">M</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/40 px-4 py-2 rounded-full border border-yellow-500/60 backdrop-blur-md">
             <span className="text-yellow-400 font-bold text-lg">{coins} COINS</span>
          </div>
      </div>

      <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto max-h-[96vh] shadow-2xl" />
      
      {!gameOver && (
        <div className="absolute bottom-16 text-white/30 text-sm font-bold uppercase tracking-[0.5em] animate-pulse">
           Glissez pour courir
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/99 flex flex-col items-center justify-center p-8 text-center z-30 backdrop-blur-3xl">
          <h2 className="text-9xl font-headline font-bold text-white tracking-tighter italic mb-10">ARRÊTÉ</h2>
          <div className="flex gap-6 mb-20">
             <div className="bg-white/10 px-10 py-8 rounded-3xl border border-white/20">
                <p className="text-4xl font-bold">{Math.floor(score / 10)}M</p>
                <p className="text-xs uppercase text-white/40 mt-2">Distance</p>
             </div>
             <div className="bg-white/10 px-10 py-8 rounded-3xl border border-white/20">
                <p className="text-4xl font-bold text-yellow-500">{coins}</p>
                <p className="text-xs uppercase text-white/40 mt-2">Pièces</p>
             </div>
          </div>
          <Button onClick={initGame} size="lg" className="rounded-full px-24 py-14 text-4xl font-bold bg-primary hover:bg-primary/90 transition-all hover:scale-105 shadow-2xl shadow-primary/60">
            REPARTIR
          </Button>
        </div>
      )}
    </div>
  );
}
