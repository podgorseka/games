"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Play,
  RotateCcw,
  Flame,
  Coins,
  Gauge,
  ChevronLeft,
  ChevronRight,
  Zap,
  Trophy,
} from 'lucide-react'

// ---------- Constants ----------
const CW = 960
const CH = 540
const HORIZON = Math.floor(CH * 0.42)
const ROAD_Y_BOTTOM = CH
const ROAD_HALF_NEAR = 470 // half-width of road at the bottom (near camera)
const ROAD_HALF_FAR = 18   // half-width of road at the horizon (far)
const LANE_COUNT = 4
const PLAYER_X_LIMIT = ROAD_HALF_NEAR - 70 // how far player can steer
const PLAYER_Y = CH - 110 // player car projected y (fixed)
const MAX_TRAFFIC = 7
const MAX_COINS = 6
const NEAR_MISS_DIST = 72 // distance in px (screen-space) at player line

// Pseudo-3D projection: convert a z in [0..1] (0 = camera, 1 = horizon) to screen y & scale
// We use a non-linear curve for stronger perspective at far distance.
const projectZ = (z: number) => {
  // z is 0..1 where 0 = near, 1 = far (horizon)
  // y goes from CH (bottom) to HORIZON
  // scale shrinks with z
  const t = z
  // ease to compress near the horizon
  const ease = 1 - Math.pow(1 - t, 2.4)
  const y = ROAD_Y_BOTTOM - (ROAD_Y_BOTTOM - HORIZON) * ease
  // perspective scale
  const scale = 1 - ease * 0.985
  return { y, scale }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v))

// ---------- Types ----------
type Vehicle = {
  id: number
  lane: number // 0..LANE_COUNT-1
  z: number // 0..1, 1 = far
  zVel: number // how fast this car travels relative to world (negative = being overtaken fast)
  color: string
  accent: string
  type: 'car' | 'truck' | 'sport'
  length: number // visual length factor
}

type Coin = {
  id: number
  lane: number
  z: number
  collected: boolean
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
  kind: 'spark' | 'smoke' | 'flame' | 'coin' | 'debris'
}

type Prop = {
  side: -1 | 1
  z: number
  kind: 'pole' | 'sign' | 'billboard'
  color?: string
  text?: string
}

// ---------- Component ----------
export default function ApexRacer({
  onGameOver,
  isMobile,
}: {
  onGameOver: (score: number) => void
  isMobile: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [coins, setCoins] = useState(0)
  const [combo, setCombo] = useState(0)
  const [speedKph, setSpeedKph] = useState(0)
  const [nitroPct, setNitroPct] = useState(0)
  const [distance, setDistance] = useState(0)

  // Physics refs
  const playerX = useRef(0) // -PLAYER_X_LIMIT..PLAYER_X_LIMIT
  const playerVX = useRef(0)
  const speed = useRef(0) // world units per frame
  const targetSpeed = useRef(0)
  const nitro = useRef(0) // 0..1
  const nitroActive = useRef(false)
  const roadScroll = useRef(0) // for lane stripe animation
  const totalDist = useRef(0)
  const traffic = useRef<Vehicle[]>([])
  const coinsArr = useRef<Coin[]>([])
  const particles = useRef<Particle[]>([])
  const props = useRef<Prop[]>([])
  const keys = useRef<Record<string, boolean>>({})
  const steerInput = useRef(0) // -1..1
  const tick = useRef(0)
  const shake = useRef(0)
  const tilt = useRef(0) // camera tilt based on steer, radians
  const cameraSway = useRef(0)
  const reportedRef = useRef(false)
  const comboRef = useRef(0)
  const nearMissArm = useRef<Record<number, boolean>>({})

  // ---------- Init ----------
  const reset = useCallback(() => {
    playerX.current = 0
    playerVX.current = 0
    speed.current = 0.011
    targetSpeed.current = 0.015
    nitro.current = 0
    nitroActive.current = false
    roadScroll.current = 0
    totalDist.current = 0
    traffic.current = []
    coinsArr.current = []
    particles.current = []
    steerInput.current = 0
    tick.current = 0
    shake.current = 0
    tilt.current = 0
    cameraSway.current = 0
    comboRef.current = 0
    nearMissArm.current = {}
    reportedRef.current = false
    setScore(0)
    setCoins(0)
    setCombo(0)
    setNitroPct(0)
    setDistance(0)
    setSpeedKph(0)

    // Pre-generate props (roadside poles, signs)
    const propsArr: Prop[] = []
    for (let i = 0; i < 60; i++) {
      propsArr.push({ side: -1, z: Math.random(), kind: 'pole' })
      propsArr.push({ side: 1, z: Math.random(), kind: 'pole' })
    }
    for (let i = 0; i < 6; i++) {
      propsArr.push({
        side: Math.random() > 0.5 ? -1 : 1,
        z: Math.random(),
        kind: 'billboard',
        color: ['#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#fb7185'][i % 5],
        text: ['NEON', 'TURBO', 'APEX', 'NITRO', 'RACE', 'MAX'][i % 6],
      })
    }
    props.current = propsArr
  }, [])

  // ---------- Spawning ----------
  const spawnTraffic = useCallback(() => {
    if (traffic.current.length >= MAX_TRAFFIC) return
    // Low probability spawn, scaled very gently with speed
    const roll = Math.random()
    if (roll > 0.022 + speed.current * 0.6) return

    // Never fully block all lanes in the far band — guarantee a passable gap
    const farLanes = new Set(traffic.current.filter(c => c.z > 0.6).map(c => c.lane))
    if (farLanes.size >= LANE_COUNT - 1) return

    // Pick a lane that doesn't already have a car close to the horizon
    const candidates: number[] = []
    for (let l = 0; l < LANE_COUNT; l++) {
      const blocker = traffic.current.find(c => c.lane === l && c.z > 0.7)
      if (!blocker) candidates.push(l)
    }
    if (candidates.length === 0) return
    const lane = candidates[Math.floor(Math.random() * candidates.length)]

    // Also avoid spawning right next to another spawning lane (give player lateral space)
    const adjacentBusy = traffic.current.some(
      c => Math.abs(c.lane - lane) === 1 && c.z > 0.82
    )
    if (adjacentBusy && Math.random() < 0.7) return

    const palette = [
      { body: '#ef4444', accent: '#7f1d1d' },
      { body: '#3b82f6', accent: '#1e3a8a' },
      { body: '#22c55e', accent: '#14532d' },
      { body: '#f59e0b', accent: '#78350f' },
      { body: '#e879f9', accent: '#701a75' },
      { body: '#06b6d4', accent: '#164e63' },
      { body: '#e2e8f0', accent: '#334155' },
      { body: '#0f172a', accent: '#1e293b' },
    ]
    const r = Math.random()
    const type: Vehicle['type'] = r > 0.92 ? 'truck' : r > 0.6 ? 'sport' : 'car'
    const pal = palette[Math.floor(Math.random() * palette.length)]
    // AI traffic moves in the SAME direction as the player, almost as fast.
    // The small difference is the "overtaking speed" — that's what makes them approachable & dodgeable.
    // Trucks slower, sports faster.
    const baseAiSpeed =
      type === 'truck'
        ? 0.0085 + Math.random() * 0.0015
        : type === 'sport'
        ? 0.011 + Math.random() * 0.002
        : 0.0095 + Math.random() * 0.0018
    const v: Vehicle = {
      id: Math.random(),
      lane,
      z: 1,
      zVel: baseAiSpeed,
      color: pal.body,
      accent: pal.accent,
      type,
      length: type === 'truck' ? 1.8 : type === 'sport' ? 0.95 : 1.1,
    }
    traffic.current.push(v)
  }, [])

  const spawnCoin = useCallback(() => {
    if (coinsArr.current.length >= MAX_COINS) return
    if (Math.random() > 0.03) return
    const lane = Math.floor(Math.random() * LANE_COUNT)
    // avoid spawning on traffic
    if (traffic.current.some(c => c.lane === lane && c.z > 0.9)) return
    coinsArr.current.push({ id: Math.random(), lane, z: 1, collected: false })
  }, [])

  // ---------- Particles helpers ----------
  const pushParticle = (p: Particle) => {
    if (particles.current.length > 180) particles.current.shift()
    particles.current.push(p)
  }

  const explode = (x: number, y: number) => {
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 2 + Math.random() * 6
      pushParticle({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2,
        life: 0, max: 36 + Math.random() * 20,
        color: ['#fbbf24', '#f97316', '#ef4444', '#fde68a'][Math.floor(Math.random() * 4)],
        size: 2 + Math.random() * 4,
        kind: 'spark',
      })
    }
    for (let i = 0; i < 14; i++) {
      pushParticle({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: -(1 + Math.random() * 3),
        life: 0, max: 60 + Math.random() * 20,
        color: '#1f2937',
        size: 8 + Math.random() * 12,
        kind: 'smoke',
      })
    }
  }

  // ---------- Lane helpers ----------
  const laneToX = (lane: number) => {
    // evenly spaced across road width (at near = ROAD_HALF_NEAR)
    const pad = 0.12 // margin
    const slot = (1 - pad * 2) / LANE_COUNT
    const t = pad + slot * (lane + 0.5)
    return lerp(-ROAD_HALF_NEAR, ROAD_HALF_NEAR, t)
  }

  // ---------- Update ----------
  const update = useCallback(() => {
    if (gameState !== 'playing') return
    tick.current++

    // Steering input
    const kLeft = keys.current['ArrowLeft'] || keys.current['KeyA'] || keys.current['TouchLeft']
    const kRight = keys.current['ArrowRight'] || keys.current['KeyD'] || keys.current['TouchRight']
    const kUp = keys.current['ArrowUp'] || keys.current['KeyW']
    const kDown = keys.current['ArrowDown'] || keys.current['KeyS']
    const kNitro = keys.current['Space'] || keys.current['TouchNitro']

    let steerTarget = 0
    if (kLeft) steerTarget -= 1
    if (kRight) steerTarget += 1
    // smooth steer
    steerInput.current += (steerTarget - steerInput.current) * 0.18

    // lateral acceleration scales with speed (more responsive when fast)
    const steerStrength = 14 * (0.6 + speed.current * 40)
    playerVX.current += steerInput.current * steerStrength * 0.1
    playerVX.current *= 0.78 // damping
    playerX.current += playerVX.current
    // clamp and bounce a bit on edges
    if (playerX.current > PLAYER_X_LIMIT) {
      playerX.current = PLAYER_X_LIMIT
      playerVX.current *= -0.2
    }
    if (playerX.current < -PLAYER_X_LIMIT) {
      playerX.current = -PLAYER_X_LIMIT
      playerVX.current *= -0.2
    }

    // Camera tilt (visual effect: whole scene subtly rotates opposite to steering)
    tilt.current += (-steerInput.current * 0.03 - tilt.current) * 0.1
    cameraSway.current = Math.sin(tick.current * 0.03) * 0.6

    // Throttle / speed
    // Player slightly faster than traffic so you OVERTAKE them steadily (not slam into them).
    // Traffic runs ~0.0085..0.013, so a delta of 0.003..0.006 gives comfortable dodge time.
    const baseMax = 0.015 // world units per frame (equiv ~180 kph display)
    const boostMax = 0.024
    let maxSpeed = baseMax
    nitroActive.current = false
    if (kNitro && nitro.current > 0.02) {
      nitroActive.current = true
      maxSpeed = boostMax
      nitro.current = Math.max(0, nitro.current - 0.008)
    } else {
      // regen nitro slowly from driving
      nitro.current = Math.min(1, nitro.current + 0.0006)
    }
    if (kDown) maxSpeed *= 0.35
    if (kUp || isMobile || true) {
      // auto-accelerate always for arcade feel
      targetSpeed.current = maxSpeed
    }
    speed.current += (targetSpeed.current - speed.current) * 0.05

    const currentKph = Math.floor(speed.current * 12000)
    setSpeedKph(currentKph)
    setNitroPct(nitro.current)

    // Road scroll for stripes
    roadScroll.current += speed.current * 800
    // Distance & score
    const distInc = speed.current * 3.2
    totalDist.current += distInc
    setDistance(totalDist.current)

    // base score: distance; multiplied by combo
    const baseScoreInc = distInc * (1 + Math.min(comboRef.current, 20) * 0.08)
    setScore(s => Math.floor(s + baseScoreInc))

    // Move traffic z: decreases with (playerSpeed - carSpeed)
    for (const v of traffic.current) {
      v.z -= (speed.current - v.zVel)
      // once fully past, remove
    }
    // remove off-screen
    traffic.current = traffic.current.filter(v => v.z > -0.12 && v.z < 1.12)

    // Move coins
    for (const c of coinsArr.current) c.z -= speed.current
    coinsArr.current = coinsArr.current.filter(c => !c.collected && c.z > -0.05 && c.z < 1.1)

    // Scroll props (they are static on world; their z decreases)
    for (const p of props.current) {
      p.z -= speed.current * 0.55
      if (p.z < -0.08) {
        p.z = 1 + Math.random() * 0.2
      }
    }

    // Spawn new entities
    spawnTraffic()
    spawnCoin()

    // Collision & near-miss detection:
    // Player is at (playerX.current, PLAYER_Y) in screen space. Traffic cars are projected each frame.
    const playerLeft = playerX.current - 58
    const playerRight = playerX.current + 58
    for (const v of traffic.current) {
      if (v.z > 0.02 && v.z < 0.12) {
        // Near player; check collision
        const vx = laneToX(v.lane)
        const proj = projectZ(v.z)
        const carW = 110 * (0.4 + proj.scale * 0.6)
        const carY = proj.y - 20 * proj.scale
        const vxScreen = vx * (0.5 + proj.scale * 0.5)
        const vLeft = vxScreen - carW / 2
        const vRight = vxScreen + carW / 2
        const vertOverlap = Math.abs(carY - PLAYER_Y) < 70
        if (vertOverlap && vLeft < playerRight && vRight > playerLeft) {
          // collision
          explode(playerX.current + CW / 2, PLAYER_Y - 10)
          shake.current = 26
          setGameState('over')
          return
        }
      }
      // near miss: when a car that was ahead passes the player line (z near 0.05) without collision, arm flag
      if (v.z < 0.1 && v.z > 0.02 && !nearMissArm.current[v.id]) {
        const vx = laneToX(v.lane)
        const proj = projectZ(v.z)
        const vxScreen = vx * (0.5 + proj.scale * 0.5)
        const dx = Math.abs(vxScreen - playerX.current)
        if (dx < NEAR_MISS_DIST + 60 && dx > 50) {
          nearMissArm.current[v.id] = true
        }
      }
      if (v.z < 0.02 && nearMissArm.current[v.id]) {
        // consumed near miss
        delete nearMissArm.current[v.id]
        comboRef.current = Math.min(20, comboRef.current + 1)
        setCombo(comboRef.current)
        // small score bonus + nitro
        setScore(s => s + 50 + comboRef.current * 10)
        nitro.current = Math.min(1, nitro.current + 0.05)
        // spark
        for (let i = 0; i < 8; i++) {
          pushParticle({
            x: playerX.current + CW / 2 + (Math.random() - 0.5) * 80,
            y: PLAYER_Y - 30,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 4 - 1,
            life: 0, max: 26 + Math.random() * 10,
            color: '#fbbf24',
            size: 2 + Math.random() * 2,
            kind: 'spark',
          })
        }
      }
    }

    // Coin pickup
    for (const c of coinsArr.current) {
      if (c.collected) continue
      if (c.z < 0.08 && c.z > 0) {
        const cx = laneToX(c.lane)
        const proj = projectZ(c.z)
        const cxScreen = cx * (0.5 + proj.scale * 0.5)
        const dy = Math.abs(proj.y - PLAYER_Y)
        if (Math.abs(cxScreen - playerX.current) < 60 && dy < 40) {
          c.collected = true
          setCoins(n => n + 1)
          setScore(s => s + 25)
          nitro.current = Math.min(1, nitro.current + 0.04)
          for (let i = 0; i < 10; i++) {
            pushParticle({
              x: cxScreen + CW / 2,
              y: proj.y,
              vx: (Math.random() - 0.5) * 5,
              vy: -(Math.random() * 5 + 1),
              life: 0, max: 30 + Math.random() * 10,
              color: '#fbbf24',
              size: 2 + Math.random() * 3,
              kind: 'coin',
            })
          }
        }
      }
    }

    // Reset combo if we spend >6s without near miss
    if (comboRef.current > 0 && tick.current % 360 === 0) {
      comboRef.current = Math.max(0, comboRef.current - 1)
      setCombo(comboRef.current)
    }

    // Update particles
    for (const p of particles.current) {
      p.life++
      p.x += p.vx
      p.y += p.vy
      if (p.kind === 'smoke') {
        p.vy *= 0.98
        p.vx *= 0.98
        p.size += 0.3
      } else if (p.kind === 'spark' || p.kind === 'debris') {
        p.vy += 0.28
        p.vx *= 0.96
      } else if (p.kind === 'flame') {
        p.vy *= 0.92
        p.size *= 0.98
      } else if (p.kind === 'coin') {
        p.vy += 0.22
        p.vx *= 0.97
      }
    }
    particles.current = particles.current.filter(p => p.life < p.max)

    // Player exhaust / trail
    if (tick.current % 2 === 0) {
      pushParticle({
        x: playerX.current + CW / 2 + (Math.random() - 0.5) * 10 - 18,
        y: PLAYER_Y + 48,
        vx: (Math.random() - 0.5) * 1,
        vy: 0.5 + Math.random() * 0.8,
        life: 0, max: 26,
        color: nitroActive.current ? '#60a5fa' : '#94a3b8',
        size: 4 + Math.random() * 3,
        kind: 'smoke',
      })
      pushParticle({
        x: playerX.current + CW / 2 + (Math.random() - 0.5) * 10 + 18,
        y: PLAYER_Y + 48,
        vx: (Math.random() - 0.5) * 1,
        vy: 0.5 + Math.random() * 0.8,
        life: 0, max: 26,
        color: nitroActive.current ? '#60a5fa' : '#94a3b8',
        size: 4 + Math.random() * 3,
        kind: 'smoke',
      })
    }
    if (nitroActive.current) {
      for (let i = 0; i < 2; i++) {
        pushParticle({
          x: playerX.current + CW / 2 + (Math.random() - 0.5) * 28 + (i === 0 ? -18 : 18),
          y: PLAYER_Y + 50,
          vx: (Math.random() - 0.5) * 2,
          vy: 3 + Math.random() * 2,
          life: 0, max: 14 + Math.random() * 8,
          color: ['#f97316', '#fbbf24', '#ef4444'][Math.floor(Math.random() * 3)],
          size: 4 + Math.random() * 4,
          kind: 'flame',
        })
      }
    }

    if (shake.current > 0) shake.current *= 0.88
  }, [gameState, spawnTraffic, spawnCoin, isMobile])

  // ---------- Render ----------
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Apply shake + tilt
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const sx = (Math.random() - 0.5) * shake.current
    const sy = (Math.random() - 0.5) * shake.current
    ctx.translate(sx, sy)

    // --- Sky gradient (cached-ish) ---
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON)
    sky.addColorStop(0, '#1a0b2e')
    sky.addColorStop(0.35, '#3b1161')
    sky.addColorStop(0.7, '#c026d3')
    sky.addColorStop(0.9, '#fb923c')
    sky.addColorStop(1, '#fde047')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, CW, HORIZON)

    // Sun / glow
    const sunX = CW * 0.58
    const sunY = HORIZON - 12
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 210)
    sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.9)')
    sunGlow.addColorStop(0.35, 'rgba(251, 146, 60, 0.45)')
    sunGlow.addColorStop(1, 'rgba(251, 146, 60, 0)')
    ctx.fillStyle = sunGlow
    ctx.fillRect(0, 0, CW, HORIZON + 40)
    // actual sun disc
    ctx.fillStyle = '#fde68a'
    ctx.beginPath()
    ctx.arc(sunX, sunY - 6, 34, 0, Math.PI * 2)
    ctx.fill()
    // subtle bands on sun
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(sunX - 32, sunY - 6 + 8 + i * 10)
      ctx.lineTo(sunX + 32, sunY - 6 + 8 + i * 10)
      ctx.stroke()
    }

    // Stars / distant lights (only upper area)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    for (let i = 0; i < 35; i++) {
      const sx2 = (i * 97 + 31) % CW
      const sy2 = (i * 53) % (HORIZON * 0.6)
      const a = 0.3 + Math.sin(tick.current * 0.05 + i) * 0.3 + 0.3
      ctx.globalAlpha = a
      ctx.fillRect(sx2, sy2, 1.4, 1.4)
    }
    ctx.globalAlpha = 1

    // --- Distant mountain silhouette ---
    ctx.fillStyle = '#2a1554'
    ctx.beginPath()
    ctx.moveTo(0, HORIZON)
    let px = 0
    const mountainSeed = [0.2, 0.5, 0.1, 0.55, 0.25, 0.7, 0.3, 0.6, 0.15, 0.5, 0.2, 0.65, 0.35, 0.55, 0.2, 0.5]
    const step = CW / (mountainSeed.length - 1)
    for (let i = 0; i < mountainSeed.length; i++) {
      const y = HORIZON - mountainSeed[i] * 70
      ctx.lineTo(px, y)
      px += step
    }
    ctx.lineTo(CW, HORIZON)
    ctx.closePath()
    ctx.fill()

    // Closer mountain layer
    ctx.fillStyle = '#1a0b3e'
    ctx.beginPath()
    ctx.moveTo(0, HORIZON)
    px = 0
    const closer = [0.0, 0.08, 0.02, 0.15, 0.05, 0.22, 0.08, 0.28, 0.12, 0.25, 0.05, 0.2, 0.1, 0.18, 0.05, 0.1, 0.02, 0.08, 0.0]
    const step2 = CW / (closer.length - 1)
    for (let i = 0; i < closer.length; i++) {
      const y = HORIZON - closer[i] * 80 + 8
      ctx.lineTo(px, y)
      px += step2
    }
    ctx.lineTo(CW, HORIZON)
    ctx.closePath()
    ctx.fill()

    // City silhouette (bottom of mountains)
    ctx.fillStyle = '#0a0520'
    let cx = 0
    const citySeq = [18, 30, 14, 22, 10, 35, 18, 26, 14, 30, 22, 18, 28, 14, 22, 16, 30, 14, 24, 18, 28, 10, 32, 18, 22]
    ctx.beginPath()
    ctx.moveTo(0, HORIZON + 2)
    for (const h of citySeq) {
      const w = 12 + ((h * 3) % 20)
      ctx.lineTo(cx, HORIZON + 2 - h)
      ctx.lineTo(cx + w, HORIZON + 2 - h)
      cx += w
    }
    ctx.lineTo(CW, HORIZON + 2)
    ctx.closePath()
    ctx.fill()

    // City lights (tiny dots)
    ctx.fillStyle = 'rgba(253, 224, 71, 0.85)'
    for (let i = 0; i < 60; i++) {
      const lx = (i * 37) % CW
      const ly = HORIZON - ((i * 13) % 18) - 3
      if ((i + Math.floor(tick.current / 20)) % 7 !== 0) {
        ctx.fillRect(lx, ly, 1.5, 1.5)
      }
    }

    // --- Ground (below horizon) ---
    const ground = ctx.createLinearGradient(0, HORIZON, 0, CH)
    ground.addColorStop(0, '#1a0b3e')
    ground.addColorStop(0.3, '#2d1b5e')
    ground.addColorStop(1, '#13082f')
    ctx.fillStyle = ground
    ctx.fillRect(0, HORIZON, CW, CH - HORIZON)

    // Horizon glow line
    const hGlow = ctx.createLinearGradient(0, HORIZON - 2, 0, HORIZON + 10)
    hGlow.addColorStop(0, 'rgba(251, 146, 60, 0.9)')
    hGlow.addColorStop(1, 'rgba(251, 146, 60, 0)')
    ctx.fillStyle = hGlow
    ctx.fillRect(0, HORIZON - 2, CW, 12)

    // --- Road: draw segments from far to near for proper overlap ---
    // Main trapezoid road fill
    const nearYBottom = CH
    const roadCenterX = CW / 2 + playerX.current * 0.02 // tiny parallax for camera feel
    const nearLeft = roadCenterX - ROAD_HALF_NEAR
    const nearRight = roadCenterX + ROAD_HALF_NEAR
    const farLeft = roadCenterX - ROAD_HALF_FAR
    const farRight = roadCenterX + ROAD_HALF_FAR

    // Road asphalt gradient (darker at the center horizon, lighter near)
    const roadGrad = ctx.createLinearGradient(0, HORIZON, 0, CH)
    roadGrad.addColorStop(0, '#1c1038')
    roadGrad.addColorStop(0.5, '#141426')
    roadGrad.addColorStop(1, '#0c0c18')
    ctx.fillStyle = roadGrad
    ctx.beginPath()
    ctx.moveTo(farLeft, HORIZON)
    ctx.lineTo(farRight, HORIZON)
    ctx.lineTo(nearRight, nearYBottom)
    ctx.lineTo(nearLeft, nearYBottom)
    ctx.closePath()
    ctx.fill()

    // Rumble strips (edges) - alternate white/red based on z
    const rumbleWidth = 24
    // Build a series of rumble bands by sampling z
    const bands = 22
    for (let i = 0; i < bands; i++) {
      const zFar = 1 - (i + 1) / bands
      const zNear = 1 - i / bands
      const pFar = projectZ(zFar)
      const pNear = projectZ(zNear)
      const halfFar = lerp(ROAD_HALF_FAR, ROAD_HALF_NEAR, pFar.scale) * 0.99
      const halfNear = lerp(ROAD_HALF_FAR, ROAD_HALF_NEAR, pNear.scale) * 0.99
      const rumbleFarThick = lerp(1, rumbleWidth, pFar.scale)
      const rumbleNearThick = lerp(1, rumbleWidth, pNear.scale)
      // alternate color based on band index + scroll
      const alt = (Math.floor(i + roadScroll.current * 0.01) % 2) === 0
      ctx.fillStyle = alt ? '#ef4444' : '#f1f5f9'
      // Left rumble
      ctx.beginPath()
      ctx.moveTo(roadCenterX - halfFar - rumbleFarThick, pFar.y)
      ctx.lineTo(roadCenterX - halfFar, pFar.y)
      ctx.lineTo(roadCenterX - halfNear, pNear.y)
      ctx.lineTo(roadCenterX - halfNear - rumbleNearThick, pNear.y)
      ctx.closePath()
      ctx.fill()
      // Right rumble
      ctx.beginPath()
      ctx.moveTo(roadCenterX + halfFar, pFar.y)
      ctx.lineTo(roadCenterX + halfFar + rumbleFarThick, pFar.y)
      ctx.lineTo(roadCenterX + halfNear + rumbleNearThick, pNear.y)
      ctx.lineTo(roadCenterX + halfNear, pNear.y)
      ctx.closePath()
      ctx.fill()
    }

    // White edge lines
    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(farLeft + 1, HORIZON)
    ctx.lineTo(nearLeft + 2, nearYBottom)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(farRight - 1, HORIZON)
    ctx.lineTo(nearRight - 2, nearYBottom)
    ctx.stroke()

    // Lane dividers (3 dividers for 4 lanes) - animated dashes
    const dashesPerLane = 26
    const scroll = roadScroll.current
    for (let laneIdx = 1; laneIdx < LANE_COUNT; laneIdx++) {
      const isCenter = laneIdx === LANE_COUNT / 2
      for (let i = 0; i < dashesPerLane; i++) {
        // z for this dash segment
        const phase = ((i * 0.04) + (scroll % 100) / 100 * 0.04) % 1
        const zBase = (i / dashesPerLane) + phase
        const zEnd = zBase + 0.02
        if (zBase > 1 || zEnd < 0) continue
        const zFar = clamp(zEnd, 0, 1)
        const zNear = clamp(zBase, 0, 1)
        const pFar = projectZ(zFar)
        const pNear = projectZ(zNear)
        const halfFar = lerp(ROAD_HALF_FAR, ROAD_HALF_NEAR, pFar.scale)
        const halfNear = lerp(ROAD_HALF_FAR, ROAD_HALF_NEAR, pNear.scale)
        // lane divider x is at fraction laneIdx/LANE_COUNT from left edge
        const tx = laneIdx / LANE_COUNT
        const xFar = (roadCenterX - halfFar) + halfFar * 2 * tx
        const xNear = (roadCenterX - halfNear) + halfNear * 2 * tx
        const thicknessFar = lerp(0.5, 6, pFar.scale)
        const thicknessNear = lerp(0.5, 6, pNear.scale)
        ctx.fillStyle = isCenter ? '#facc15' : '#f8fafc'
        ctx.beginPath()
        ctx.moveTo(xFar - thicknessFar / 2, pFar.y)
        ctx.lineTo(xFar + thicknessFar / 2, pFar.y)
        ctx.lineTo(xNear + thicknessNear / 2, pNear.y)
        ctx.lineTo(xNear - thicknessNear / 2, pNear.y)
        ctx.closePath()
        ctx.fill()
      }
    }
    // Extra second solid line on center (double yellow)
    for (let i = 0; i < 22; i++) {
      const zBase = i / 22
      const zEnd = zBase + 0.012
      if (zBase > 1 || zEnd < 0) continue
      const pFar = projectZ(zEnd)
      const pNear = projectZ(zBase)
      const halfFar = lerp(ROAD_HALF_FAR, ROAD_HALF_NEAR, pFar.scale)
      const halfNear = lerp(ROAD_HALF_FAR, ROAD_HALF_NEAR, pNear.scale)
      const thicknessFar = lerp(0.3, 3, pFar.scale)
      const thicknessNear = lerp(0.3, 3, pNear.scale)
      const offsetFar = halfFar * 0.02
      const offsetNear = halfNear * 0.02
      const xFar = roadCenterX + offsetFar
      const xNear = roadCenterX + offsetNear
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.moveTo(xFar - thicknessFar / 2, pFar.y)
      ctx.lineTo(xFar + thicknessFar / 2, pFar.y)
      ctx.lineTo(xNear + thicknessNear / 2, pNear.y)
      ctx.lineTo(xNear - thicknessNear / 2, pNear.y)
      ctx.closePath()
      ctx.fill()
    }

    // --- Props (roadside poles & billboards) ---
    // Sort by z far -> near
    const sortedProps = [...props.current].sort((a, b) => b.z - a.z)
    for (const p of sortedProps) {
      if (p.z < 0 || p.z > 1) continue
      const proj = projectZ(p.z)
      const half = lerp(ROAD_HALF_FAR, ROAD_HALF_NEAR, proj.scale)
      const x = roadCenterX + p.side * (half + 30 + 30 * proj.scale)
      const y = proj.y
      if (p.kind === 'pole') {
        const polH = 90 * proj.scale + 6
        const polW = Math.max(1, 3 * proj.scale)
        // Pole
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(x - polW / 2, y - polH, polW, polH)
        // Lamp head
        ctx.fillStyle = '#334155'
        const lampW = Math.max(4, 18 * proj.scale)
        const lampH = Math.max(2, 8 * proj.scale)
        ctx.fillRect(x - lampW / 2 + p.side * (lampW * 0.3), y - polH, lampW, lampH)
        // Light bulb glow
        const bulbX = x + p.side * (lampW * 0.3)
        const bulbY = y - polH + lampH
        const glow = ctx.createRadialGradient(bulbX, bulbY, 0, bulbX, bulbY, 60 * proj.scale + 6)
        glow.addColorStop(0, 'rgba(254, 240, 138, 0.9)')
        glow.addColorStop(1, 'rgba(254, 240, 138, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(bulbX - 80, bulbY - 80, 160, 160)
        // Light cone on road
        if (proj.scale > 0.2) {
          const coneGrad = ctx.createLinearGradient(bulbX, bulbY, bulbX, bulbY + 120 * proj.scale)
          coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)')
          coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)')
          ctx.fillStyle = coneGrad
          ctx.beginPath()
          ctx.moveTo(bulbX, bulbY)
          ctx.lineTo(bulbX - 36 * proj.scale, bulbY + 120 * proj.scale)
          ctx.lineTo(bulbX + 36 * proj.scale, bulbY + 120 * proj.scale)
          ctx.closePath()
          ctx.fill()
        }
      } else if (p.kind === 'billboard' && proj.scale > 0.2) {
        // Neon billboard
        const bw = 120 * proj.scale
        const bh = 60 * proj.scale
        const bx = x + p.side * 30
        const by = y - 140 * proj.scale
        // post
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(bx - 2, by + bh, 4, 100 * proj.scale)
        // frame
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(bx - bw / 2 - 4, by - 4, bw + 8, bh + 8)
        // screen
        const signGrad = ctx.createLinearGradient(bx - bw / 2, by, bx + bw / 2, by + bh)
        signGrad.addColorStop(0, p.color || '#22d3ee')
        signGrad.addColorStop(1, '#0f172a')
        ctx.fillStyle = signGrad
        ctx.fillRect(bx - bw / 2, by, bw, bh)
        // neon glow
        const bGlow = ctx.createRadialGradient(bx, by + bh / 2, 0, bx, by + bh / 2, bw * 0.9)
        bGlow.addColorStop(0, (p.color || '#22d3ee') + 'aa')
        bGlow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = bGlow
        ctx.fillRect(bx - bw, by - bh / 2, bw * 2, bh * 2)
        ctx.restore()
        // text
        if (p.text && proj.scale > 0.5) {
          ctx.fillStyle = '#ffffff'
          ctx.font = `bold ${Math.floor(bh * 0.45)}px "Inter", system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(p.text, bx, by + bh / 2)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'alphabetic'
        }
      }
    }

    // --- Traffic ---
    // Sort traffic far->near
    const sortedTraffic = [...traffic.current].sort((a, b) => b.z - a.z)
    for (const v of sortedTraffic) {
      if (v.z < -0.05 || v.z > 1.05) continue
      drawCar(ctx, roadCenterX, v)
    }

    // --- Coins ---
    for (const c of coinsArr.current) {
      if (c.collected || c.z < 0 || c.z > 1) continue
      const proj = projectZ(c.z)
      const cx = laneToX(c.lane) * (0.5 + proj.scale * 0.5)
      const cy = proj.y - 24 * proj.scale
      const r = 14 * proj.scale + 2
      // coin with rotation
      const rot = Math.sin(tick.current * 0.1 + c.id * 4) * 0.9 + 0.1
      const rx = Math.max(2, r * Math.abs(rot))
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(roadCenterX + cx, proj.y + 6, r * 0.9, r * 0.3, 0, 0, Math.PI * 2)
      ctx.fill()
      // coin body
      const grad = ctx.createLinearGradient(roadCenterX + cx - rx, cy - r, roadCenterX + cx + rx, cy + r)
      grad.addColorStop(0, '#fde047')
      grad.addColorStop(0.5, '#f59e0b')
      grad.addColorStop(1, '#b45309')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.ellipse(roadCenterX + cx, cy, rx, r, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = Math.max(1, 1.5 * proj.scale)
      ctx.stroke()
      // Glow
      if (proj.scale > 0.3) {
        const cGlow = ctx.createRadialGradient(roadCenterX + cx, cy, 0, roadCenterX + cx, cy, r * 2.5)
        cGlow.addColorStop(0, 'rgba(253, 224, 71, 0.4)')
        cGlow.addColorStop(1, 'rgba(253, 224, 71, 0)')
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = cGlow
        ctx.fillRect(roadCenterX + cx - r * 3, cy - r * 3, r * 6, r * 6)
        ctx.restore()
      }
    }

    // --- Particles (behind player for smoke, in front for flames/sparks) ---
    for (const p of particles.current) {
      if (p.kind !== 'smoke' && p.kind !== 'flame') continue
      const alpha = 1 - p.life / p.max
      ctx.globalAlpha = alpha * (p.kind === 'flame' ? 1 : 0.5)
      if (p.kind === 'flame') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2)
        grad.addColorStop(0, p.color)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
      } else {
        ctx.fillStyle = p.color
      }
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // --- Player car ---
    drawPlayerCar(ctx, CW / 2 + playerX.current, PLAYER_Y, steerInput.current, nitroActive.current)

    // --- Sparks/debris above player ---
    for (const p of particles.current) {
      if (p.kind !== 'spark' && p.kind !== 'coin' && p.kind !== 'debris') continue
      const alpha = 1 - p.life / p.max
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // --- Speed lines (radial) when going fast / nitro ---
    if (speed.current > 0.012) {
      const intensity = clamp((speed.current - 0.012) / 0.016, 0, 1) * (nitroActive.current ? 1.6 : 1)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 * intensity})`
      ctx.lineWidth = 2
      const cxp = CW / 2
      const cyp = HORIZON + 40
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + tick.current * 0.02
        const r1 = 60 + (tick.current * 6 + i * 17) % 300
        const r2 = r1 + 80 + 60 * intensity
        ctx.beginPath()
        ctx.moveTo(cxp + Math.cos(ang) * r1, cyp + Math.sin(ang) * r1 * 0.6)
        ctx.lineTo(cxp + Math.cos(ang) * r2, cyp + Math.sin(ang) * r2 * 0.6)
        ctx.stroke()
      }
      ctx.restore()
    }

    // --- Vignette ---
    const vign = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.45, CW / 2, CH / 2, Math.max(CW, CH) * 0.75)
    vign.addColorStop(0, 'rgba(0,0,0,0)')
    vign.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = vign
    ctx.fillRect(0, 0, CW, CH)

    // --- Subtle scanlines ---
    ctx.save()
    ctx.globalAlpha = 0.05
    ctx.fillStyle = '#000'
    for (let y = 0; y < CH; y += 3) ctx.fillRect(0, y, CW, 1)
    ctx.restore()

    // --- Chromatic-ish flash on nitro ---
    if (nitroActive.current) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = 'rgba(59, 130, 246, 0.06)'
      ctx.fillRect(0, 0, CW, CH)
      ctx.restore()
    }

    ctx.restore()
  }, [])

  // ---------- Car drawing helpers ----------
  const drawCar = (ctx: CanvasRenderingContext2D, roadCenterX: number, v: Vehicle) => {
    const proj = projectZ(v.z)
    // At far z (horizon), cars almost at road center; near z, full lane offset.
    const laneOffset = laneToX(v.lane) * (0.5 + proj.scale * 0.5)
    const cx = roadCenterX + laneOffset
    const cy = proj.y - 10 * proj.scale
    const baseW = v.type === 'truck' ? 80 : v.type === 'sport' ? 58 : 68
    const baseH = v.type === 'truck' ? 150 : v.type === 'sport' ? 110 : 120
    const w = baseW * proj.scale
    const h = baseH * proj.scale * v.length
    if (w < 2 || h < 2) return
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.ellipse(cx, cy + h * 0.45, w * 0.6, w * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()

    // Body
    const bodyGrad = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    bodyGrad.addColorStop(0, v.accent)
    bodyGrad.addColorStop(0.5, v.color)
    bodyGrad.addColorStop(1, v.accent)
    ctx.fillStyle = bodyGrad
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, Math.max(1, w * 0.15))
    ctx.fill()

    // Roof / windshield (as car is viewed from behind going away)
    if (proj.scale > 0.15) {
      const glassGrad = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h * 0.1)
      glassGrad.addColorStop(0, '#1e293b')
      glassGrad.addColorStop(1, '#0ea5e9')
      ctx.fillStyle = glassGrad
      roundRect(
        ctx,
        cx - w * 0.35,
        cy - h * 0.3,
        w * 0.7,
        h * 0.35,
        Math.max(1, w * 0.1)
      )
      ctx.fill()
      // rear window (closer to camera)
      ctx.fillStyle = '#0b1220'
      roundRect(
        ctx,
        cx - w * 0.32,
        cy + h * 0.1,
        w * 0.64,
        h * 0.18,
        Math.max(1, w * 0.08)
      )
      ctx.fill()
    }

    // Tail lights (we see cars from behind — we're chasing them)
    if (proj.scale > 0.12) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = '#fca5a5'
      const tlw = Math.max(2, w * 0.18)
      const tlh = Math.max(2, h * 0.06)
      ctx.fillRect(cx - w * 0.4, cy + h * 0.42 - tlh, tlw, tlh)
      ctx.fillRect(cx + w * 0.4 - tlw, cy + h * 0.42 - tlh, tlw, tlh)
      // glow
      const tlG = ctx.createRadialGradient(cx - w * 0.3, cy + h * 0.42, 0, cx - w * 0.3, cy + h * 0.42, w * 0.6)
      tlG.addColorStop(0, 'rgba(239, 68, 68, 0.5)')
      tlG.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = tlG
      ctx.fillRect(cx - w, cy, w * 2, h)
      ctx.restore()
    }

    // Headlights cone pointing AWAY (upward on screen) since cars go forward
    if (proj.scale > 0.25) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const hlG = ctx.createLinearGradient(cx, cy - h / 2, cx, cy - h)
      hlG.addColorStop(0, 'rgba(254, 240, 138, 0.3)')
      hlG.addColorStop(1, 'rgba(254, 240, 138, 0)')
      ctx.fillStyle = hlG
      ctx.beginPath()
      ctx.moveTo(cx - w * 0.3, cy - h * 0.45)
      ctx.lineTo(cx + w * 0.3, cy - h * 0.45)
      ctx.lineTo(cx + w, cy - h * 1.2)
      ctx.lineTo(cx - w, cy - h * 1.2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // Wheels
    if (proj.scale > 0.15) {
      ctx.fillStyle = '#0a0a0a'
      const ww = Math.max(2, w * 0.14)
      const wh = Math.max(2, h * 0.18)
      ctx.fillRect(cx - w / 2 - ww * 0.3, cy - h * 0.28, ww, wh)
      ctx.fillRect(cx + w / 2 - ww * 0.7, cy - h * 0.28, ww, wh)
      ctx.fillRect(cx - w / 2 - ww * 0.3, cy + h * 0.1, ww, wh)
      ctx.fillRect(cx + w / 2 - ww * 0.7, cy + h * 0.1, ww, wh)
    }
  }

  const drawPlayerCar = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    steer: number,
    nitroActive: boolean
  ) => {
    const w = 112
    const h = 178
    const tilt = steer * 0.09

    // Underglow
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const ug = ctx.createRadialGradient(cx, cy + h * 0.55, 0, cx, cy + h * 0.55, w * 1.4)
    ug.addColorStop(0, nitroActive ? 'rgba(251, 146, 60, 0.6)' : 'rgba(34, 211, 238, 0.45)')
    ug.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = ug
    ctx.fillRect(cx - w * 2, cy - 30, w * 4, h)
    ctx.restore()

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    ctx.ellipse(cx, cy + h * 0.45, w * 0.55, w * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)

    // Body (view from behind — red sports car)
    const bodyGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2)
    bodyGrad.addColorStop(0, '#7f1d1d')
    bodyGrad.addColorStop(0.5, '#dc2626')
    bodyGrad.addColorStop(1, '#450a0a')
    ctx.fillStyle = bodyGrad
    roundRect(ctx, -w / 2, -h / 2, w, h, 18)
    ctx.fill()

    // Hood highlight (near the front = top of screen)
    const hood = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 + h * 0.25)
    hood.addColorStop(0, 'rgba(255,255,255,0.25)')
    hood.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = hood
    roundRect(ctx, -w / 2 + 6, -h / 2 + 4, w - 12, h * 0.22, 12)
    ctx.fill()

    // Roof / windshield
    const glass = ctx.createLinearGradient(0, -h * 0.28, 0, h * 0.1)
    glass.addColorStop(0, '#0f172a')
    glass.addColorStop(1, '#0ea5e9')
    ctx.fillStyle = glass
    roundRect(ctx, -w * 0.36, -h * 0.32, w * 0.72, h * 0.42, 12)
    ctx.fill()
    // racing stripe
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(-4, -h / 2 + 4, 8, h - 8)

    // Rear window
    ctx.fillStyle = '#0b1220'
    roundRect(ctx, -w * 0.34, h * 0.1, w * 0.68, h * 0.22, 10)
    ctx.fill()

    // Spoiler
    ctx.fillStyle = '#0f172a'
    roundRect(ctx, -w * 0.48, h * 0.38, w * 0.96, 10, 3)
    ctx.fill()
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(-w * 0.35, h * 0.32, 4, 14)
    ctx.fillRect(w * 0.35 - 4, h * 0.32, 4, 14)

    // Headlights
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = '#fef3c7'
    roundRect(ctx, -w / 2 + 8, -h / 2 + 6, w * 0.22, 10, 4)
    ctx.fill()
    roundRect(ctx, w / 2 - w * 0.22 - 8, -h / 2 + 6, w * 0.22, 10, 4)
    ctx.fill()
    // headlight beams
    const beam = ctx.createLinearGradient(0, -h / 2, 0, -h)
    beam.addColorStop(0, 'rgba(254, 243, 199, 0.35)')
    beam.addColorStop(1, 'rgba(254, 243, 199, 0)')
    ctx.fillStyle = beam
    ctx.beginPath()
    ctx.moveTo(-w * 0.35, -h / 2 + 4)
    ctx.lineTo(w * 0.35, -h / 2 + 4)
    ctx.lineTo(w * 0.9, -h)
    ctx.lineTo(-w * 0.9, -h)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // Tail lights
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = '#fca5a5'
    roundRect(ctx, -w / 2 + 6, h / 2 - 14, w * 0.35, 8, 3)
    ctx.fill()
    roundRect(ctx, w / 2 - w * 0.35 - 6, h / 2 - 14, w * 0.35, 8, 3)
    ctx.fill()
    const tl = ctx.createRadialGradient(0, h / 2, 0, 0, h / 2, w)
    tl.addColorStop(0, 'rgba(239, 68, 68, 0.5)')
    tl.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = tl
    ctx.fillRect(-w * 1.2, h / 2 - 10, w * 2.4, 40)
    ctx.restore()

    // Wheels (dark with chrome)
    ctx.fillStyle = '#0a0a0a'
    const ww = 16
    const wh = 30
    ctx.fillRect(-w / 2 - 2, -h * 0.3, ww, wh)
    ctx.fillRect(w / 2 - ww + 2, -h * 0.3, ww, wh)
    ctx.fillRect(-w / 2 - 2, h * 0.1, ww, wh)
    ctx.fillRect(w / 2 - ww + 2, h * 0.1, ww, wh)
    // chrome rim dots
    ctx.fillStyle = '#94a3b8'
    ctx.beginPath()
    ctx.arc(-w / 2 + ww / 2 - 2, -h * 0.3 + wh / 2, 3, 0, Math.PI * 2)
    ctx.arc(w / 2 - ww / 2 + 2, -h * 0.3 + wh / 2, 3, 0, Math.PI * 2)
    ctx.arc(-w / 2 + ww / 2 - 2, h * 0.1 + wh / 2, 3, 0, Math.PI * 2)
    ctx.arc(w / 2 - ww / 2 + 2, h * 0.1 + wh / 2, 3, 0, Math.PI * 2)
    ctx.fill()

    // Exhaust
    ctx.fillStyle = '#334155'
    ctx.fillRect(-18, h / 2 - 6, 10, 10)
    ctx.fillRect(8, h / 2 - 6, 10, 10)

    ctx.restore()
  }

  // ---------- Round rect helper ----------
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.lineTo(x + w - rr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
    ctx.lineTo(x + w, y + h - rr)
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
    ctx.lineTo(x + rr, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
    ctx.lineTo(x, y + rr)
    ctx.quadraticCurveTo(x, y, x + rr, y)
    ctx.closePath()
  }

  // ---------- Canvas sizing (DPR) ----------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = clamp(window.devicePixelRatio || 1, 1, isMobile ? 1.6 : 2)
    canvas.width = CW * dpr
    canvas.height = CH * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [isMobile])

  // ---------- Game loop (fixed timestep) ----------
  useEffect(() => {
    if (gameState !== 'playing') return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const step = 1000 / 60

    const loop = (t: number) => {
      const dt = Math.min(100, t - last)
      last = t
      acc += dt
      // Cap updates to avoid spiral of death
      let updates = 0
      while (acc >= step && updates < 5) {
        update()
        acc -= step
        updates++
      }
      render()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [gameState, update, render])

  // ---------- Input: keyboard ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
      keys.current[e.code] = true
      if (e.code === 'Enter' && gameState !== 'playing') {
        setGameState('playing')
        reset()
      }
      if (e.code === 'KeyR' && gameState === 'over') {
        setGameState('playing')
        reset()
      }
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [gameState, reset])

  // ---------- Input: touch (swipe anywhere) ----------
  const touchState = useRef<{ id: number; startX: number; lastX: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== 'playing') return
    const t = e.changedTouches[0]
    if (!t) return
    // ignore touches on controls
    const target = e.target as HTMLElement
    if (target.closest('[data-ctrl]')) return
    touchState.current = { id: t.identifier, startX: t.clientX, lastX: t.clientX }
  }
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchState.current) return
    const t = Array.from(e.changedTouches).find(ct => ct.identifier === touchState.current!.id)
    if (!t) return
    const dx = t.clientX - touchState.current.lastX
    touchState.current.lastX = t.clientX
    if (dx < -2) {
      keys.current['TouchLeft'] = true
      keys.current['TouchRight'] = false
    } else if (dx > 2) {
      keys.current['TouchRight'] = true
      keys.current['TouchLeft'] = false
    }
  }
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = Array.from(e.changedTouches).find(ct => ct.identifier === touchState.current?.id)
    if (!t) return
    keys.current['TouchLeft'] = false
    keys.current['TouchRight'] = false
    touchState.current = null
  }

  // ---------- Start / Restart ----------
  const startGame = () => {
    reset()
    setGameState('playing')
  }

  // Reporting
  useEffect(() => {
    if (gameState === 'over' && !reportedRef.current) {
      reportedRef.current = true
      setBest(b => Math.max(b, score))
      onGameOver(score)
    }
  }, [gameState, score, onGameOver])

  // Steering helpers for on-screen buttons
  const setTouchKey = (k: 'TouchLeft' | 'TouchRight' | 'TouchNitro', val: boolean) => {
    keys.current[k] = val
  }

  // ---------- Format helpers ----------
  const formatScore = (s: number) => s.toLocaleString('fr-FR')
  const formatDist = (d: number) => {
    const km = d / 1000
    return km >= 1 ? `${km.toFixed(2)} km` : `${Math.floor(d)} m`
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-screen h-[100dvh] select-none flex items-center justify-center bg-black overflow-hidden touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* 16:9 letterbox so the canvas never distorts on portrait or ultrawide screens */}
      <div
        className="relative"
        style={{
          width: 'min(100vw, calc(100dvh * 16 / 9))',
          height: 'min(100dvh, calc(100vw * 9 / 16))',
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />

        {/* HUD (playing) */}
        {gameState === 'playing' && (
          <>
            {/* Top HUD */}
            <div className="absolute top-0 left-0 right-0 p-3 md:p-4 flex items-start justify-between pointer-events-none z-10">
              <div className="flex flex-col gap-2">
                <div className="bg-black/55 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase tracking-widest text-white/60">Score</span>
                    <span className="font-bold text-white text-lg tabular-nums">
                      {formatScore(score)}
                    </span>
                  </div>
                </div>
                <div className="bg-black/55 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-400" />
                  <span className="font-bold text-white tabular-nums">{coins}</span>
                  <span className="text-white/50 text-xs ml-2">· {formatDist(distance)}</span>
                </div>
              </div>

              {/* Combo */}
              <div
                className={`transition-all ${
                  combo > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                } bg-gradient-to-br from-orange-500 to-red-600 border border-white/20 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg`}
              >
                <Flame className="h-5 w-5 text-white" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase tracking-widest text-white/80">Combo</span>
                  <span className="font-extrabold text-white text-xl tabular-nums">x{combo}</span>
                </div>
              </div>
            </div>

            {/* Bottom HUD: speedometer + nitro */}
            <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 pointer-events-none z-10">
              <div className="flex items-end justify-between gap-3">
                {/* Speedometer */}
                <div className="bg-black/55 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
                  <Gauge className="h-6 w-6 text-cyan-400" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase tracking-widest text-white/60">Vitesse</span>
                    <span className="font-extrabold text-white text-2xl tabular-nums">
                      {speedKph}
                    </span>
                  </div>
                  <span className="text-white/50 text-xs">km/h</span>
                </div>

                {/* Nitro bar */}
                <div className="bg-black/55 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex-1 max-w-[260px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-widest text-white/60 flex items-center gap-1">
                      <Zap className="h-3 w-3 text-cyan-400" /> Nitro
                    </span>
                    <span className="text-xs font-bold text-white">{Math.floor(nitroPct * 100)}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 transition-[width]"
                      style={{ width: `${nitroPct * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile on-screen controls */}
            {isMobile && (
              <div className="absolute bottom-20 left-0 right-0 flex items-end justify-between px-4 pointer-events-none z-20">
                <button
                  data-ctrl="left"
                  aria-label="Gauche"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    setTouchKey('TouchLeft', true)
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    setTouchKey('TouchLeft', false)
                  }}
                  onTouchCancel={() => setTouchKey('TouchLeft', false)}
                  className="pointer-events-auto bg-white/10 backdrop-blur-md active:bg-white/25 active:scale-95 border border-white/20 rounded-full h-20 w-20 flex items-center justify-center shadow-xl"
                >
                  <ChevronLeft className="h-10 w-10 text-white" />
                </button>

                <button
                  data-ctrl="nitro"
                  aria-label="Nitro"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    setTouchKey('TouchNitro', true)
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    setTouchKey('TouchNitro', false)
                  }}
                  onTouchCancel={() => setTouchKey('TouchNitro', false)}
                  className={`pointer-events-auto transition-all active:scale-95 border-2 rounded-full h-24 w-24 flex flex-col items-center justify-center shadow-2xl ${
                    nitroPct > 0.05
                      ? 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 border-white/40 animate-pulse'
                      : 'bg-white/10 border-white/20'
                  }`}
                >
                  <Flame className="h-9 w-9 text-white" />
                  <span className="text-[10px] font-bold text-white mt-0.5 tracking-wider">NITRO</span>
                </button>

                <button
                  data-ctrl="right"
                  aria-label="Droite"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    setTouchKey('TouchRight', true)
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    setTouchKey('TouchRight', false)
                  }}
                  onTouchCancel={() => setTouchKey('TouchRight', false)}
                  className="pointer-events-auto bg-white/10 backdrop-blur-md active:bg-white/25 active:scale-95 border border-white/20 rounded-full h-20 w-20 flex items-center justify-center shadow-xl"
                >
                  <ChevronRight className="h-10 w-10 text-white" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Start Overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-950/90 via-slate-950/95 to-black/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-30 p-6">
            <div className="text-center space-y-3">
              <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-orange-300 via-pink-500 to-purple-600 drop-shadow-[0_2px_20px_rgba(251,146,60,0.5)]">
                APEX RACER
              </h1>
              <p className="text-white/70 text-sm md:text-base max-w-md mx-auto">
                Slalomez entre les voitures au coucher du soleil. Chaque frôlement = combo x. Collectez les pièces, videz la nitro, devenez légendaire.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs md:text-sm">
              {isMobile ? (
                <>
                  <span className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white/90">Glisser / Boutons — Diriger</span>
                  <span className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white/90">Bouton rouge — Nitro</span>
                </>
              ) : (
                <>
                  <span className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white/90">← → ou A/D — Diriger</span>
                  <span className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white/90">Espace — Nitro</span>
                  <span className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white/90">↓ — Freiner</span>
                </>
              )}
            </div>

            <Button
              onClick={startGame}
              size="lg"
              className="h-14 px-10 text-xl font-black rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 border-2 border-white/30 shadow-[0_0_40px_rgba(251,146,60,0.5)]"
            >
              <Play className="mr-2 h-6 w-6 fill-white" />
              DÉMARRER
            </Button>

            {best > 0 && (
              <div className="text-white/60 text-sm">
                Meilleur score : <span className="font-bold text-yellow-400">{formatScore(best)}</span>
              </div>
            )}
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'over' && (
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/90 via-black/95 to-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center gap-5 z-30 p-6">
            <div className="text-center space-y-2">
              <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-red-300 to-red-600">
                Crash !
              </h2>
              <p className="text-white/70 text-sm">Votre course est terminée.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              <div className="bg-white/10 border border-white/20 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/60">Score</div>
                <div className="text-2xl font-black text-white tabular-nums">{formatScore(score)}</div>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/60">Distance</div>
                <div className="text-2xl font-black text-white tabular-nums">{formatDist(distance)}</div>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/60">Pièces</div>
                <div className="text-2xl font-black text-yellow-400 tabular-nums">{coins}</div>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/60">Vitesse max</div>
                <div className="text-2xl font-black text-cyan-400 tabular-nums">{speedKph}</div>
              </div>
            </div>

            <Button
              onClick={startGame}
              size="lg"
              className="h-14 px-10 text-xl font-black rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 border-2 border-white/30 shadow-[0_0_40px_rgba(34,211,238,0.5)]"
            >
              <RotateCcw className="mr-2 h-6 w-6" />
              REJOUER
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
