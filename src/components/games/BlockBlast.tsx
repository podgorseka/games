"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Loader2 } from 'lucide-react';
import { generateBlockBlastLevel, type GenerateBlockBlastLevelOutput } from '@/ai/flows/block-blast-level-generator';

const GRID_SIZE = 8;

export default function BlockBlast({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const [grid, setGrid] = useState<string[][]>(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('')));
  const [pieces, setPieces] = useState<{ id: number, shape: number[][], color: string }[]>([]);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draggingPiece, setDraggingPiece] = useState<{ id: number, offset: { x: number, y: number } } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const fetchLevel = useCallback(async () => {
    setLoading(true);
    try {
      const level = await generateBlockBlastLevel({ difficulty: 'medium' });
      const newGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));
      level.initialBlocks.forEach(b => {
        if (b.row < GRID_SIZE && b.col < GRID_SIZE) {
          newGrid[b.row][b.col] = b.type;
        }
      });
      setGrid(newGrid);
      generateNewPieces();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  const generateNewPieces = () => {
    const availableShapes = [
      [[1]], 
      [[1, 1]], 
      [[1], [1]], 
      [[1, 1], [1, 1]], 
      [[1, 1, 1]], 
      [[1], [1], [1]], 
      [[1, 1, 1], [0, 1, 0]],
      [[1, 0], [1, 1]]
    ];
    const colors = ['#C41DFA', '#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D'];
    const newPieces = Array.from({ length: 3 }).map((_, i) => ({
      id: Math.random(),
      shape: availableShapes[Math.floor(Math.random() * availableShapes.length)],
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setPieces(newPieces);
  };

  useEffect(() => {
    fetchLevel();
  }, [fetchLevel]);

  const canPlace = (shape: number[][], startRow: number, startCol: number) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const gridR = startRow + r;
          const gridC = startCol + c;
          if (gridR < 0 || gridR >= GRID_SIZE || gridC < 0 || gridC >= GRID_SIZE || grid[gridR][gridC] !== '') {
            return false;
          }
        }
      }
    }
    return true;
  };

  const placePiece = (pieceId: number, startRow: number, startCol: number) => {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece || !canPlace(piece.shape, startRow, startCol)) return false;

    const newGrid = grid.map(row => [...row]);
    piece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) newGrid[startRow + r][startCol + c] = piece.color;
      });
    });

    // Check lines
    const rowsToClear: number[] = [];
    const colsToClear: number[] = [];
    for (let r = 0; r < GRID_SIZE; r++) if (newGrid[r].every(cell => cell !== '')) rowsToClear.push(r);
    for (let c = 0; c < GRID_SIZE; c++) if (newGrid.every(row => row[c] !== '')) colsToClear.push(c);

    rowsToClear.forEach(r => newGrid[r] = Array(GRID_SIZE).fill(''));
    colsToClear.forEach(c => newGrid.forEach(row => row[c] = ''));

    const linesCleared = rowsToClear.length + colsToClear.length;
    if (linesCleared > 0) {
      setScore(s => s + linesCleared * 100);
    }

    setGrid(newGrid);
    const updatedPieces = pieces.filter(p => p.id !== pieceId);
    if (updatedPieces.length === 0) {
      generateNewPieces();
    } else {
      setPieces(updatedPieces);
    }

    // Check game over
    const canMoveAny = updatedPieces.some(p => {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlace(p.shape, r, c)) return true;
        }
      }
      return false;
    });

    if (updatedPieces.length > 0 && !canMoveAny) {
      onGameOver(score);
    }

    return true;
  };

  const onDragStart = (id: number, e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDraggingPiece({ id, offset: { x: 0, y: 0 } });
    setMousePos({ x: clientX, y: clientY });
  };

  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingPiece) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setMousePos({ x: clientX, y: clientY });
  };

  const onDragEnd = () => {
    if (!draggingPiece) return;
    // Simple coordinate-based snap
    const gridEl = document.getElementById('blast-grid');
    if (gridEl) {
      const rect = gridEl.getBoundingClientRect();
      const cellSize = rect.width / GRID_SIZE;
      const col = Math.floor((mousePos.x - rect.left) / cellSize);
      const row = Math.floor((mousePos.y - rect.top) / cellSize);
      placePiece(draggingPiece.id, row, col);
    }
    setDraggingPiece(null);
  };

  if (loading) return <div className="flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-primary h-12 w-12" /><p>AI is building your level...</p></div>;

  return (
    <div 
      className="flex flex-col items-center gap-8 w-full h-full justify-center touch-none select-none"
      onMouseMove={onDragMove}
      onTouchMove={onDragMove}
      onMouseUp={onDragEnd}
      onTouchEnd={onDragEnd}
    >
      <div className="text-3xl font-headline font-bold text-primary">Score: {score}</div>

      <div 
        id="blast-grid"
        className="grid grid-cols-8 gap-1 bg-muted/30 p-2 rounded-xl border-4 border-primary shadow-2xl"
        style={{ width: 'min(90vw, 400px)', height: 'min(90vw, 400px)' }}
      >
        {grid.map((row, r) => row.map((cell, c) => (
          <div 
            key={`${r}-${c}`} 
            className="aspect-square rounded-md transition-all duration-300"
            style={{ backgroundColor: cell || 'rgba(0,0,0,0.05)' }}
          />
        )))}
      </div>

      <div className="flex gap-4 min-h-[120px]">
        {pieces.map((p) => (
          <div 
            key={p.id}
            className={`cursor-grab active:cursor-grabbing transition-transform ${draggingPiece?.id === p.id ? 'scale-110 opacity-50 fixed z-50 pointer-events-none' : ''}`}
            style={draggingPiece?.id === p.id ? { left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -50%)' } : {}}
            onMouseDown={(e) => onDragStart(p.id, e)}
            onTouchStart={(e) => onDragStart(p.id, e)}
          >
            <div className="grid" style={{ gridTemplateRows: `repeat(${p.shape.length}, 1fr)`, gridTemplateColumns: `repeat(${p.shape[0].length}, 1fr)`, gap: '2px' }}>
              {p.shape.map((row, r) => row.map((val, c) => (
                <div 
                  key={`${r}-${c}`} 
                  className="w-6 h-6 rounded-sm"
                  style={{ backgroundColor: val ? p.color : 'transparent' }}
                />
              )))}
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-muted-foreground text-sm">Drag blocks into the grid to clear lines!</p>
    </div>
  );
}
