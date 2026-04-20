"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, User, Zap, Gauge } from 'lucide-react';

const CW = 960;
const CH = 540;
const HORIZON = CH * 0.46;
const FOV = 100;
const ROAD_HALF = 360; // road half-width in world units
const SEG_LEN = 80;    // length of one road segment in z

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));

type Vehicle = {
  id: number;
  x: number;          // -240..240 lane offset
  z: number;          // depth from camera
  speed: number;
  color: string;
  type: 'car' | 'truck' | 'sport';
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type Star = { x: number; y: number; r: number; tw: number };

export default function ApexRacer({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [speedKph, setSpeedKph] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gear, setGear] = useState(1);
  const gameLoopRef = useRef<number>(0);

  const playerX = useRef(0);
  const targetX = useRef(0);
  const playerSpeed = useRef(0);
  const targetSpeed = useRef(0);
  const roadOffset = useRef(0);
  const totalDist = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const traffic = useRef<Vehicle[]>([]);
  const particles = useRef<Particle[]>([]);
  const shake = useRef(0);
  const tick = useRef(0);
  const reportedRef = useRef(false);

  // Pre-computed background elements (stars, skyline)
  const stars = useMemo<Star[]>(() => {
    const arr: Star[] = [];
    for (let i = 0; i < 120; i++) {
      arr.push({
        x: Math.random() * CW,
        y: Math.random() * HORIZON * 0.85,
        r: Math.random() * 1.4 + 0.3,
        tw: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  const skyline = useMemo(() => {
    const arr: { x: number; w: number; h: number; lit: number[] }[] = [];
    let x = -50;
    while (x < CW + 50) {
      const w = 30 + Math.random() * 70;
      const h = 30 + Math.random() * 90;
      const lit: number[] = [];
      const cols = Math.max(2, Math.floor(w / 12));
      const rows = Math.max(2, Math.floor(h / 10));
      for (let i = 0; i < cols * rows; i++) lit.push(Math.random() > 0.55 ? 1 : 0);
      arr.push({ x, w, h, lit });
      x += w + 1;
    }
    return arr;
  }, []);

  // Pre-built environment buildings along the road (left/right) with neon signs
  const sideBuildings = useMemo(() => {
    const arr: {
      side: -1 | 1;
      z: number;
      h: number;
      w: number;
      color: string;
      windows: number[];
      neon?: { color: string; y: number };
    }[] = [];
    const neonColors = ['#22d3ee', '#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#fb7185'];
    for (let i = 0; i < 60; i++) {
      const z = i * 220 + Math.random() * 80;
      arr.push({
        side: -1,
        z,
        h: 600 + Math.random() * 1400,
        w: 600 + Math.random() * 400,
        color: ['#0b1224', '#0f172a', '#111a30', '#0a1020'][Math.floor(Math.random() * 4)],
        windows: Array.from({ length: 200 }, () => (Math.random() > 0.55 ? 1 : 0)),
        neon: Math.random() > 0.6 ? { color: neonColors[Math.floor(Math.random() * neonColors.length)], y: Math.random() } : undefined,
      });
      arr.push({
        side: 1,
        z: z + 110,
        h: 600 + Math.random() * 1400,
        w: 600 + Math.random() * 400,
        color: ['#0b1224', '#0f172a', '#111a30', '#0a1020'][Math.floor(Math.random() * 4)],
        windows: Array.from({ length: 200 }, () => (Math.random() > 0.55 ? 1 : 0)),
        neon: Math.random() > 0.6 ? { color: neonColors[Math.floor(Math.random() * neonColors.length)], y: Math.random() } : undefined,
      });
    }
    return arr;
  }, []);

  // Lampposts every 400 z units alternating sides
  const lamps = useMemo(() => {
    const arr: { side: -1 | 1; z: number }[] = [];
    for (let i = 0; i < 100; i++) {
      arr.push({ side: i % 2 === 0 ? -1 : 1, z: i * 400 });
    }
    return arr;
  }, []);

  // Curve provides x offset per z. Smooth long sine curves.
  const curveAt = (zWorld: number) => {
    return Math.sin(zWorld * 0.00045) * 600 + Math.sin(zWorld * 0.00018) * 900;
  };

  const initGame = useCallback(() => {
    playerX.current = 0;
    targetX.current = 0;
    playerSpeed.current = 0.05;
    targetSpeed.current = 0.05;
    roadOffset.current = 0;
    totalDist.current = 0;
    traffic.current = [];
    particles.current = [];
    shake.current = 0;
    tick.current = 0;
    reportedRef.current = false;
    setScore(0);
    setDistance(0);
    setGear(1);
    setGameOver(false);
  }, []);

  const spawnTraffic = useCallback(() => {
    if (traffic.current.length > 6) return;
    const lanes = [-200, -100, 0, 100, 200];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    if (traffic.current.some(t => Math.abs(t.z - 7000) < 1500 && Math.abs(t.x - laneX) < 80)) return;
    const palette = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#e2e8f0', '#0f172a', '#a855f7', '#06b6d4'];
    const r = Math.random();
    const type: Vehicle['type'] = r > 0.88 ? 'truck' : r > 0.55 ? 'sport' : 'car';
    traffic.current.push({
      id: Math.random(),
      x: laneX,
      z: 7000 + Math.random() * 2000,
      speed: 0.025 + Math.random() * 0.06,
      color: palette[Math.floor(Math.random() * palette.length)],
      type,
    });
  }, []);

  const update = useCallback(() => {
    if (gameOver) return;
    tick.current++;

    // Steering
    if (keys.current['LeftPress']) targetX.current -= 14;
    if (keys.current['RightPress']) targetX.current += 14;
    targetX.current = clamp(targetX.current, -260, 260);
    playerX.current += (targetX.current - playerX.current) * 0.14;

    // Throttle
    if (keys.current['Accel']) targetSpeed.current = Math.min(0.62, targetSpeed.current + 0.0065);
    else if (keys.current['Brake']) targetSpeed.current = Math.max(0, targetSpeed.current - 0.022);
    else targetSpeed.current = Math.max(0.05, targetSpeed.current - 0.003);
    playerSpeed.current += (targetSpeed.current - playerSpeed.current) * 0.08;

    const currentKph = Math.floor(playerSpeed.current * 540);
    setSpeedKph(currentKph);
    setGear(clamp(Math.floor(currentKph / 50) + 1, 1, 6));

    const distInc = playerSpeed.current * 0.012;
    totalDist.current += distInc;
    setDistance(totalDist.current);
    roadOffset.current = (roadOffset.current + playerSpeed.current * 320);

    if (Math.random() < 0.025) spawnTraffic();
    traffic.current.forEach(car => {
      const relSpeed = (playerSpeed.current - car.speed) * 200;
      car.z -= relSpeed;
      const carWidth = car.type === 'truck' ? 130 : car.type === 'sport' ? 95 : 100;
      if (car.z > -10 && car.z < 110) {
        const dx = Math.abs(car.x - playerX.current);
        if (dx < carWidth - 35) {
          shake.current = 30;
          // burst particles
          for (let i = 0; i < 40; i++) {
            particles.current.push({
              x: CW / 2 + (playerX.current - 0) * 0.5,
              y: CH * 0.85,
              vx: (Math.random() - 0.5) * 14,
              vy: -Math.random() * 12,
              life: 60 + Math.random() * 40,
              maxLife: 100,
              color: ['#fbbf24', '#f97316', '#ef4444', '#fde68a'][Math.floor(Math.random() * 4)],
              size: 2 + Math.random() * 4,
            });
          }
          setGameOver(true);
        }
      }
    });
    traffic.current = traffic.current.filter(c => c.z > -2000 && c.z < 9500);

    // Speed-line / dust particles
    if (playerSpeed.current > 0.2 && tick.current % 2 === 0) {
      particles.current.push({
        x: CW / 2 + (Math.random() - 0.5) * CW * 1.1,
        y: HORIZON + Math.random() * (CH - HORIZON),
        vx: 0,
        vy: 0,
        life: 18,
        maxLife: 18,
        color: 'rgba(255,255,255,0.55)',
        size: 1 + Math.random() * 1.4,
      });
    }

    // Update particles
    particles.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
      p.life--;
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // shake decay
    shake.current = Math.max(0, shake.current - 1);

    setScore(s => s + Math.floor(playerSpeed.current * 22));
  }, [gameOver, spawnTraffic]);

  // Report game over once
  useEffect(() => {
    if (gameOver && !reportedRef.current) {
      reportedRef.current = true;
      onGameOver(Math.floor(totalDist.current * 1000));
    }
  }, [gameOver, onGameOver]);

  /* ============================== DRAW ============================== */

  const drawSky = (ctx: CanvasRenderingContext2D) => {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#04050f');
    sky.addColorStop(0.45, '#0a0a2e');
    sky.addColorStop(0.78, '#3b1c5a');
    sky.addColorStop(0.92, '#a13d6e');
    sky.addColorStop(1, '#f59e0b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CW, HORIZON);

    // Stars (only above mid sky)
    stars.forEach(s => {
      const alpha = 0.4 + Math.sin(tick.current * 0.05 + s.tw) * 0.3;
      const fadeY = clamp(1 - s.y / (HORIZON * 0.7), 0, 1);
      ctx.fillStyle = `rgba(255,255,255,${alpha * fadeY})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Moon with glow
    const moonX = CW * 0.78;
    const moonY = HORIZON * 0.32;
    const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 90);
    glow.addColorStop(0, 'rgba(255,236,179,0.55)');
    glow.addColorStop(0.4, 'rgba(255,200,150,0.18)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,140,90,0.25)';
    ctx.beginPath();
    ctx.arc(moonX - 6, moonY - 4, 6, 0, Math.PI * 2);
    ctx.arc(moonX + 8, moonY + 6, 4, 0, Math.PI * 2);
    ctx.arc(moonX - 2, moonY + 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // Horizon haze
    const haze = ctx.createLinearGradient(0, HORIZON - 80, 0, HORIZON);
    haze.addColorStop(0, 'transparent');
    haze.addColorStop(1, 'rgba(245,158,11,0.35)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, HORIZON - 80, CW, 80);

    // Distant skyline silhouette (parallax with curve direction)
    const parallax = -((roadOffset.current * 0.06) % CW);
    const drawSkyline = (offX: number) => {
      let cx = offX;
      skyline.forEach(b => {
        if (cx + b.w > -10 && cx < CW + 10) {
          ctx.fillStyle = '#06081a';
          ctx.fillRect(cx, HORIZON - b.h, b.w, b.h);
          // window dots
          const cols = Math.max(2, Math.floor(b.w / 12));
          const rows = Math.max(2, Math.floor(b.h / 10));
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (b.lit[r * cols + c]) {
                ctx.fillStyle = `rgba(254,240,138,${0.4 + ((r + c) % 3) * 0.12})`;
                ctx.fillRect(cx + 3 + c * 12, HORIZON - b.h + 3 + r * 10, 2, 2);
              }
            }
          }
        }
        cx += b.w + 1;
      });
    };
    drawSkyline(parallax);
    drawSkyline(parallax + CW);
  };

  const drawGround = (ctx: CanvasRenderingContext2D) => {
    // dark asphalt base
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, HORIZON, CW, CH - HORIZON);

    // wet road reflection of sky / city glow
    const refl = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 140);
    refl.addColorStop(0, 'rgba(245,158,11,0.18)');
    refl.addColorStop(0.5, 'rgba(120,80,140,0.10)');
    refl.addColorStop(1, 'transparent');
    ctx.fillStyle = refl;
    ctx.fillRect(0, HORIZON, CW, 160);
  };

  // Project a world point into screen coordinates
  const project = (worldX: number, worldZ: number) => {
    const z = Math.max(1, worldZ);
    const s = FOV / (FOV + z);
    const cBase = curveAt(roadOffset.current);
    const c = curveAt(roadOffset.current + worldZ) - cBase;
    const screenX = CW / 2 + (worldX + c - playerX.current) * s * 4.5;
    const screenY = HORIZON + (CH - HORIZON) * s;
    return { screenX, screenY, scale: s };
  };

  const drawRoad = (ctx: CanvasRenderingContext2D) => {
    // Render road as quads from far to near
    const baseSegIdx = Math.floor(roadOffset.current / SEG_LEN);
    const numDraw = 80;

    type Seg = {
      i: number;
      n1: { sx: number; sy: number; sw: number };
      n2: { sx: number; sy: number; sw: number };
    };
    const segs: Seg[] = [];

    const cBase = curveAt(roadOffset.current);
    for (let i = numDraw; i >= 0; i--) {
      const segIdx = baseSegIdx + i;
      const z1 = (segIdx) * SEG_LEN - roadOffset.current;
      const z2 = (segIdx + 1) * SEG_LEN - roadOffset.current;
      if (z2 < 0) continue;
      const zz1 = Math.max(1, z1);
      const zz2 = Math.max(1, z2);

      const s1 = FOV / (FOV + zz1);
      const s2 = FOV / (FOV + zz2);
      const c1 = curveAt(roadOffset.current + zz1) - cBase;
      const c2 = curveAt(roadOffset.current + zz2) - cBase;
      const sx1 = CW / 2 + (c1 - playerX.current) * s1 * 4.5;
      const sx2 = CW / 2 + (c2 - playerX.current) * s2 * 4.5;
      const sy1 = HORIZON + (CH - HORIZON) * s1;
      const sy2 = HORIZON + (CH - HORIZON) * s2;
      const sw1 = ROAD_HALF * s1 * 4.5;
      const sw2 = ROAD_HALF * s2 * 4.5;

      segs.push({ i: segIdx, n1: { sx: sx1, sy: sy1, sw: sw1 }, n2: { sx: sx2, sy: sy2, sw: sw2 } });
    }

    // Draw shoulders (grass / dirt — dark blue ground bands)
    segs.forEach(({ i, n1, n2 }) => {
      const isAlt = i % 2 === 0;
      // outer ground band (full width across entire row to ground)
      ctx.fillStyle = isAlt ? '#070a18' : '#090d20';
      ctx.beginPath();
      ctx.moveTo(0, n1.sy);
      ctx.lineTo(CW, n1.sy);
      ctx.lineTo(CW, n2.sy);
      ctx.lineTo(0, n2.sy);
      ctx.closePath();
      ctx.fill();
    });

    // Draw road quads
    segs.forEach(({ i, n1, n2 }) => {
      const isAlt = i % 2 === 0;

      // Rumble strips (red/white outer)
      const rumbleColor = isAlt ? '#dc2626' : '#f8fafc';
      const rumW1 = n1.sw * 0.08;
      const rumW2 = n2.sw * 0.08;
      ctx.fillStyle = rumbleColor;
      ctx.beginPath();
      ctx.moveTo(n1.sx - n1.sw - rumW1, n1.sy);
      ctx.lineTo(n1.sx - n1.sw, n1.sy);
      ctx.lineTo(n2.sx - n2.sw, n2.sy);
      ctx.lineTo(n2.sx - n2.sw - rumW2, n2.sy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(n1.sx + n1.sw, n1.sy);
      ctx.lineTo(n1.sx + n1.sw + rumW1, n1.sy);
      ctx.lineTo(n2.sx + n2.sw + rumW2, n2.sy);
      ctx.lineTo(n2.sx + n2.sw, n2.sy);
      ctx.closePath();
      ctx.fill();

      // Asphalt
      ctx.fillStyle = isAlt ? '#0b0f1c' : '#0e1322';
      ctx.beginPath();
      ctx.moveTo(n1.sx - n1.sw, n1.sy);
      ctx.lineTo(n1.sx + n1.sw, n1.sy);
      ctx.lineTo(n2.sx + n2.sw, n2.sy);
      ctx.lineTo(n2.sx - n2.sw, n2.sy);
      ctx.closePath();
      ctx.fill();

      // Solid edge lines (white)
      ctx.fillStyle = 'rgba(248,250,252,0.85)';
      const edgeW1 = Math.max(1, 4 * (FOV / (FOV + Math.max(1, (i - Math.floor(roadOffset.current / SEG_LEN)) * SEG_LEN))));
      // Left edge
      ctx.beginPath();
      ctx.moveTo(n1.sx - n1.sw + 1, n1.sy);
      ctx.lineTo(n1.sx - n1.sw + 1 + edgeW1, n1.sy);
      ctx.lineTo(n2.sx - n2.sw + 1 + edgeW1, n2.sy);
      ctx.lineTo(n2.sx - n2.sw + 1, n2.sy);
      ctx.closePath();
      ctx.fill();
      // Right edge
      ctx.beginPath();
      ctx.moveTo(n1.sx + n1.sw - 1, n1.sy);
      ctx.lineTo(n1.sx + n1.sw - 1 - edgeW1, n1.sy);
      ctx.lineTo(n2.sx + n2.sw - 1 - edgeW1, n2.sy);
      ctx.lineTo(n2.sx + n2.sw - 1, n2.sy);
      ctx.closePath();
      ctx.fill();

      // Lane dashed lines (3 lanes -> 2 dashed dividers)
      if (isAlt) {
        ctx.fillStyle = 'rgba(254,240,138,0.9)';
        for (const off of [-0.33, 0.33]) {
          ctx.beginPath();
          ctx.moveTo(n1.sx + off * n1.sw - 2, n1.sy);
          ctx.lineTo(n1.sx + off * n1.sw + 2, n1.sy);
          ctx.lineTo(n2.sx + off * n2.sw + 2, n2.sy);
          ctx.lineTo(n2.sx + off * n2.sw - 2, n2.sy);
          ctx.closePath();
          ctx.fill();
        }
      }
    });
  };

  const drawBuildings = (ctx: CanvasRenderingContext2D) => {
    const baseSegIdx = Math.floor(roadOffset.current / SEG_LEN);
    const baseZ = baseSegIdx * SEG_LEN;
    // sort by depth desc
    const visible = sideBuildings
      .map(b => {
        // wrap to be near camera using modulo
        const span = 60 * 220;
        const rawZ = b.z;
        const adj = ((rawZ - baseZ) % span + span) % span;
        return { ...b, _z: adj };
      })
      .filter(b => b._z < 6000 && b._z > 5)
      .sort((a, b) => b._z - a._z);

    visible.forEach(b => {
      const z = b._z;
      const s = FOV / (FOV + z);
      const cBase = curveAt(roadOffset.current);
      const c = curveAt(roadOffset.current + z) - cBase;
      // building base on the side outside the road
      const xWorld = b.side * (ROAD_HALF + 220 + b.w * 0.5);
      const baseX = CW / 2 + (xWorld + c - playerX.current) * s * 4.5;
      const groundY = HORIZON + (CH - HORIZON) * s;
      const bw = b.w * s * 4.5;
      const bh = b.h * s * 4.5;
      const topY = groundY - bh;

      if (groundY < HORIZON) return;

      // building face
      ctx.fillStyle = b.color;
      ctx.fillRect(baseX - bw / 2, topY, bw, bh);

      // side shade
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(baseX + (b.side === -1 ? bw / 2 - bw * 0.18 : -bw / 2), topY, bw * 0.18, bh);

      // windows grid
      const cols = 6;
      const rows = 14;
      const ww = (bw * 0.8) / cols;
      const wh = (bh * 0.85) / rows;
      const startX = baseX - bw * 0.4;
      const startY = topY + bh * 0.06;
      for (let r = 0; r < rows; r++) {
        for (let cc = 0; cc < cols; cc++) {
          const idx = r * cols + cc;
          if (b.windows[idx % b.windows.length]) {
            const flicker = (Math.sin(tick.current * 0.02 + idx) + 1) * 0.5;
            ctx.fillStyle = `rgba(254,240,138,${0.35 + flicker * 0.55})`;
            ctx.fillRect(startX + cc * ww + ww * 0.15, startY + r * wh, ww * 0.6, wh * 0.55);
          } else {
            ctx.fillStyle = 'rgba(30,41,59,0.6)';
            ctx.fillRect(startX + cc * ww + ww * 0.15, startY + r * wh, ww * 0.6, wh * 0.55);
          }
        }
      }

      // neon sign
      if (b.neon && s > 0.04) {
        const ny = topY + bh * b.neon.y;
        ctx.save();
        ctx.shadowBlur = 25 * s * 4;
        ctx.shadowColor = b.neon.color;
        ctx.fillStyle = b.neon.color;
        ctx.fillRect(baseX - bw * 0.35, ny, bw * 0.7, Math.max(2, bh * 0.04));
        ctx.restore();
      }

      // Building outline silhouette
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(baseX - bw / 2, topY, bw, bh);
    });
  };

  const drawLamps = (ctx: CanvasRenderingContext2D) => {
    const baseSegIdx = Math.floor(roadOffset.current / SEG_LEN);
    const baseZ = baseSegIdx * SEG_LEN;
    const visible = lamps
      .map(l => {
        const span = 100 * 400;
        const adj = ((l.z - baseZ) % span + span) % span;
        return { ...l, _z: adj };
      })
      .filter(l => l._z < 5500 && l._z > 5)
      .sort((a, b) => b._z - a._z);

    visible.forEach(l => {
      const z = l._z;
      const s = FOV / (FOV + z);
      const cBase = curveAt(roadOffset.current);
      const c = curveAt(roadOffset.current + z) - cBase;
      const xWorld = l.side * (ROAD_HALF + 60);
      const baseX = CW / 2 + (xWorld + c - playerX.current) * s * 4.5;
      const groundY = HORIZON + (CH - HORIZON) * s;
      const lampH = 360 * s * 4.5;
      const armLen = -l.side * 130 * s * 4.5;

      if (groundY < HORIZON) return;

      // pole
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = Math.max(1, 4 * s * 4.5);
      ctx.beginPath();
      ctx.moveTo(baseX, groundY);
      ctx.lineTo(baseX, groundY - lampH);
      ctx.lineTo(baseX + armLen, groundY - lampH);
      ctx.stroke();

      // lamp head
      const lx = baseX + armLen;
      const ly = groundY - lampH;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(lx, ly + 6 * s * 4.5, Math.max(2, 8 * s * 4.5), 0, Math.PI * 2);
      ctx.fill();

      // light bulb glow
      const r = Math.max(20, 240 * s * 4.5);
      const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      grad.addColorStop(0, 'rgba(254,243,199,0.85)');
      grad.addColorStop(0.3, 'rgba(254,215,170,0.35)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.fill();

      // pool of light on the road
      ctx.save();
      const poolGrad = ctx.createRadialGradient(lx, groundY + 4, 0, lx, groundY + 4, r * 1.1);
      poolGrad.addColorStop(0, 'rgba(254,215,170,0.45)');
      poolGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = poolGrad;
      ctx.beginPath();
      ctx.ellipse(lx, groundY + 4, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  const drawVehicle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    z: number,
    color: string,
    isPlayer: boolean,
    type: Vehicle['type']
  ) => {
    const z0 = Math.max(1, z);
    const s = FOV / (FOV + z0);
    const cBase = curveAt(roadOffset.current);
    const c = isPlayer ? 0 : (curveAt(roadOffset.current + z0) - cBase);
    const screenX = CW / 2 + (x + c - (isPlayer ? 0 : playerX.current)) * s * 4.5;
    const screenY = HORIZON + (CH - HORIZON) * s;

    if (screenY < HORIZON || s < 0.008) return;

    const baseW = type === 'truck' ? 320 : type === 'sport' ? 220 : 240;
    const baseH = type === 'truck' ? 290 : type === 'sport' ? 170 : 180;
    const vW = baseW * s;
    const vH = baseH * s;
    const topY = screenY - vH;

    // ground shadow
    const shGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, vW * 0.85);
    shGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
    shGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 4, vW * 0.85, vH * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // car body main
    const bodyGrad = ctx.createLinearGradient(screenX - vW / 2, topY, screenX + vW / 2, topY);
    bodyGrad.addColorStop(0, shadeColor(color, -30));
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(1, shadeColor(color, -50));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    roundRect(ctx, screenX - vW / 2, topY, vW, vH, 12 * s);
    ctx.fill();

    // top highlight strip
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    roundRect(ctx, screenX - vW * 0.45, topY + vH * 0.04, vW * 0.9, vH * 0.06, 4 * s);
    ctx.fill();

    // window / windshield
    const winGrad = ctx.createLinearGradient(0, topY, 0, topY + vH * 0.5);
    winGrad.addColorStop(0, '#020617');
    winGrad.addColorStop(0.5, '#0e1a36');
    winGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = winGrad;
    ctx.beginPath();
    roundRect(ctx, screenX - vW * 0.36, topY + vH * 0.16, vW * 0.72, vH * 0.34, 6 * s);
    ctx.fill();

    // window reflection
    ctx.fillStyle = 'rgba(125,211,252,0.25)';
    ctx.beginPath();
    roundRect(ctx, screenX - vW * 0.34, topY + vH * 0.18, vW * 0.4, vH * 0.06, 3 * s);
    ctx.fill();

    // hood line
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(screenX - vW * 0.45, topY + vH * 0.55);
    ctx.lineTo(screenX + vW * 0.45, topY + vH * 0.55);
    ctx.stroke();

    // wheels (visible side)
    ctx.fillStyle = '#0a0a0a';
    const wheelW = vW * 0.13;
    const wheelH = vH * 0.16;
    ctx.beginPath();
    roundRect(ctx, screenX - vW / 2 - wheelW * 0.3, topY + vH * 0.5, wheelW, wheelH, 3 * s);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, screenX + vW / 2 - wheelW * 0.7, topY + vH * 0.5, wheelW, wheelH, 3 * s);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, screenX - vW / 2 - wheelW * 0.3, topY + vH * 0.78, wheelW, wheelH, 3 * s);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, screenX + vW / 2 - wheelW * 0.7, topY + vH * 0.78, wheelW, wheelH, 3 * s);
    ctx.fill();

    // spoiler for sport
    if (type === 'sport') {
      ctx.fillStyle = shadeColor(color, -60);
      ctx.beginPath();
      roundRect(ctx, screenX - vW * 0.45, topY + vH * 0.97, vW * 0.9, vH * 0.06, 3 * s);
      ctx.fill();
    }

    // tail lights with bloom
    ctx.save();
    ctx.shadowBlur = 22 * s;
    ctx.shadowColor = '#ef4444';
    ctx.fillStyle = '#fca5a5';
    const lW = vW * 0.28;
    const lH = vH * 0.09;
    const lY = topY + vH * 0.7;
    ctx.beginPath();
    roundRect(ctx, screenX - vW * 0.45, lY, lW, lH, 3 * s);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, screenX + vW * 0.45 - lW, lY, lW, lH, 3 * s);
    ctx.fill();
    ctx.restore();

    // license plate
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    roundRect(ctx, screenX - vW * 0.12, topY + vH * 0.85, vW * 0.24, vH * 0.06, 2 * s);
    ctx.fill();

    if (isPlayer) {
      // Headlight beams projecting forward (into the screen toward horizon)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const beam = ctx.createLinearGradient(screenX, screenY, screenX, HORIZON + 20);
      beam.addColorStop(0, 'rgba(255,253,230,0.0)');
      beam.addColorStop(0.4, 'rgba(255,250,200,0.18)');
      beam.addColorStop(1, 'rgba(255,250,200,0.0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(screenX - vW * 0.4, screenY - vH * 0.1);
      ctx.lineTo(screenX + vW * 0.4, screenY - vH * 0.1);
      ctx.lineTo(screenX + vW * 1.2, HORIZON + 20);
      ctx.lineTo(screenX - vW * 1.2, HORIZON + 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Underglow
      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#06b6d4';
      ctx.fillStyle = 'rgba(34,211,238,0.45)';
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + 2, vW * 0.55, vH * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Exhaust glow if accelerating
      if (keys.current['Accel'] && playerSpeed.current > 0.3) {
        ctx.save();
        ctx.shadowBlur = 28;
        ctx.shadowColor = '#fb923c';
        ctx.fillStyle = 'rgba(251,146,60,0.7)';
        ctx.beginPath();
        ctx.arc(screenX - vW * 0.25, topY + vH * 1.0, vW * 0.04 + Math.random() * vW * 0.02, 0, Math.PI * 2);
        ctx.arc(screenX + vW * 0.25, topY + vH * 1.0, vW * 0.04 + Math.random() * vW * 0.02, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // For oncoming traffic in distance, hint a small headlight glow
      if (z < 4000 && z > 800) {
        ctx.save();
        ctx.shadowBlur = 12 * s;
        ctx.shadowColor = '#fde68a';
        ctx.fillStyle = 'rgba(254,240,138,0.25)';
        ctx.beginPath();
        ctx.arc(screenX - vW * 0.3, topY + vH * 0.2, vW * 0.05, 0, Math.PI * 2);
        ctx.arc(screenX + vW * 0.3, topY + vH * 0.2, vW * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  const drawSpeedLines = (ctx: CanvasRenderingContext2D) => {
    if (playerSpeed.current < 0.25) return;
    const intensity = clamp((playerSpeed.current - 0.25) * 2, 0, 1);
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.08 * intensity})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r1 = 100 + Math.random() * 200;
      const r2 = r1 + 60 + Math.random() * 80;
      const cx = CW / 2;
      const cy = CH / 2 + 30;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particles.current.forEach(p => {
      const a = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  const drawVignette = (ctx: CanvasRenderingContext2D) => {
    const v = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.3, CW / 2, CH / 2, CH * 0.85);
    v.addColorStop(0, 'transparent');
    v.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, CW, CH);

    // subtle scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < CH; y += 3) ctx.fillRect(0, y, CW, 1);

    // top color bar
    const top = ctx.createLinearGradient(0, 0, 0, 60);
    top.addColorStop(0, 'rgba(0,0,0,0.5)');
    top.addColorStop(1, 'transparent');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, CW, 60);
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.save();
    if (shake.current > 0) {
      ctx.translate((Math.random() - 0.5) * shake.current * 0.6, (Math.random() - 0.5) * shake.current * 0.6);
    }

    drawSky(ctx);
    drawGround(ctx);
    drawRoad(ctx);
    drawLamps(ctx);
    drawBuildings(ctx);

    // Combine vehicles + player and depth-sort
    const all: { x: number; z: number; color: string; isPlayer: boolean; type: Vehicle['type'] }[] = [
      ...traffic.current.map(t => ({ x: t.x, z: t.z, color: t.color, isPlayer: false, type: t.type })),
      { x: playerX.current, z: 80, color: '#dc2626', isPlayer: true, type: 'sport' as const },
    ];
    all.sort((a, b) => b.z - a.z);
    all.forEach(v => drawVehicle(ctx, v.x, v.z, v.color, v.isPlayer, v.type));

    drawSpeedLines(ctx);
    drawParticles(ctx);
    drawVignette(ctx);

    ctx.restore();
  }, []);

  /* ============================== LOOP ============================== */

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => {
      update();
      draw(ctx);
      gameLoopRef.current = requestAnimationFrame(loop);
    };
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
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [initGame]);

  /* ============================== HUD ============================== */

  const speedAngle = -135 + clamp(speedKph / 320, 0, 1) * 270; // -135..+135 deg

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#020617] overflow-hidden touch-none select-none">
      {/* Top-left HUD */}
      <div className="absolute top-6 left-6 flex flex-col gap-3 z-20 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
            <Pause className="text-white h-5 w-5" />
          </div>
          <div className="bg-yellow-400 px-4 py-1.5 rounded-lg text-black font-black text-sm italic tracking-tighter shadow-xl border-b-4 border-yellow-600">
            RACE 1
          </div>
        </div>
        <div className="space-y-2 mt-1">
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border-l-4 border-slate-400 flex items-center gap-3 shadow-lg">
            <div className="h-7 w-7 bg-slate-800 rounded-full flex items-center justify-center border border-white/10">
              <User className="h-4 w-4 text-slate-300" />
            </div>
            <span className="text-white text-[11px] font-bold uppercase tracking-widest opacity-80">RIVAL_01</span>
          </div>
          <div className="bg-yellow-400/95 backdrop-blur-md px-4 py-2 rounded-xl border-l-4 border-yellow-700 flex items-center gap-3 shadow-xl">
            <div className="h-7 w-7 bg-yellow-600 rounded-full flex items-center justify-center border border-yellow-300">
              <User className="h-4 w-4 text-white" />
            </div>
            <span className="text-black text-[11px] font-black uppercase tracking-widest italic">YOU</span>
          </div>
        </div>

        {/* Distance bar */}
        <div className="mt-3 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 shadow-lg w-56">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Distance</span>
            <span className="text-[11px] font-black text-yellow-300 italic">{distance.toFixed(2)} KM</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
              style={{ width: `${clamp((distance / 10) * 100, 0, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top-right HUD: dashboard */}
      <div className="absolute top-6 right-6 z-20 pointer-events-none">
        <div className="relative bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-2xl px-5 py-4 rounded-3xl border border-white/15 shadow-2xl">
          <div className="flex items-end gap-4">
            {/* Arc speedometer */}
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#spdGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(clamp(speedKph / 320, 0, 1) * 198).toFixed(2)} 999`}
                  pathLength="264"
                />
                <defs>
                  <linearGradient id="spdGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#facc15" />
                    <stop offset="0.6" stopColor="#fb923c" />
                    <stop offset="1" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>
              {/* needle */}
              <div
                className="absolute top-1/2 left-1/2 origin-bottom"
                style={{
                  height: '38%',
                  width: '2px',
                  background: 'linear-gradient(to top, #fff, #facc15)',
                  transform: `translate(-50%, -100%) rotate(${speedAngle}deg)`,
                  boxShadow: '0 0 8px rgba(250,204,21,0.8)',
                  transformOrigin: 'bottom center',
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[9px] font-black uppercase text-yellow-300/90 tracking-widest leading-none">KPH</div>
                <div className="text-3xl font-black italic text-white tracking-tighter leading-none mt-1">{speedKph}</div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-[9px] font-black uppercase text-white/50 tracking-widest leading-none">GEAR</div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg border border-yellow-300/50">
                <span className="text-2xl font-black italic text-black leading-none">{gear}</span>
              </div>
              {/* RPM bar */}
              <div className="h-12 w-2 bg-white/10 rounded-full overflow-hidden flex flex-col-reverse">
                <div
                  className="w-full bg-gradient-to-t from-emerald-400 via-yellow-300 to-red-500"
                  style={{ height: `${clamp((speedKph % 60) / 60 * 100, 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-2">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-yellow-400 fill-current" />
              <span className="text-white/70 text-[10px] font-black uppercase tracking-widest">SCORE</span>
            </div>
            <span className="text-white text-sm font-black italic">{score.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="w-full h-auto max-h-screen shadow-2xl"
        style={{ imageRendering: 'auto' }}
      />

      {!gameOver && (
        <div className="absolute bottom-8 inset-x-8 flex justify-between z-30">
          <div
            className="w-24 h-40 bg-white/5 backdrop-blur-md border-2 border-white/10 rounded-3xl flex flex-col items-center justify-center cursor-pointer active:bg-red-500/20 transition-all active:scale-95 shadow-2xl"
            onPointerDown={() => (keys.current['Brake'] = true)}
            onPointerUp={() => (keys.current['Brake'] = false)}
          >
            <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">Brake</div>
            <div className="w-16 h-4 bg-white/10 rounded-full border border-white/20" />
          </div>

          <div
            className="w-24 h-48 bg-white/5 backdrop-blur-md border-2 border-white/10 rounded-3xl flex flex-col items-center justify-center cursor-pointer active:bg-yellow-400/20 transition-all active:scale-95 shadow-2xl"
            onPointerDown={() => (keys.current['Accel'] = true)}
            onPointerUp={() => (keys.current['Accel'] = false)}
          >
            <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">Accel</div>
            <div className="w-12 h-32 bg-yellow-400/10 rounded-2xl border border-yellow-400/30" />
          </div>
        </div>
      )}

      {!gameOver && (
        <div className="absolute inset-0 z-10 flex">
          <div
            className="flex-1"
            onPointerDown={() => (keys.current['LeftPress'] = true)}
            onPointerUp={() => (keys.current['LeftPress'] = false)}
          />
          <div
            className="flex-1"
            onPointerDown={() => (keys.current['RightPress'] = true)}
            onPointerUp={() => (keys.current['RightPress'] = false)}
          />
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-12 text-center z-50 backdrop-blur-3xl">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 via-transparent to-orange-900/40" />
          </div>
          <Gauge className="h-16 w-16 text-red-500 mb-6" />
          <h2 className="text-8xl font-black text-red-600 mb-4 tracking-tighter italic drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]">
            WASTED
          </h2>
          <p className="text-2xl text-white/60 mb-2">DISTANCE: {distance.toFixed(2)} KM</p>
          <p className="text-lg text-yellow-300 mb-12 font-black italic tracking-widest">SCORE: {score.toLocaleString()}</p>
          <Button
            onClick={initGame}
            size="lg"
            className="rounded-2xl px-20 py-12 text-3xl font-black bg-yellow-400 text-black shadow-2xl border-b-8 border-yellow-600 italic hover:bg-yellow-300"
          >
            RESTART RACE
          </Button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- helpers ----------------------------- */

function shadeColor(hex: string, percent: number) {
  // accept #rrggbb
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = clamp(Math.round(r + (percent / 100) * 255), 0, 255);
  g = clamp(Math.round(g + (percent / 100) * 255), 0, 255);
  b = clamp(Math.round(b + (percent / 100) * 255), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
