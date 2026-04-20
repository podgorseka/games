
"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { generateBlockBlastLevel } from '@/ai/flows/block-blast-level-generator';
import { Button } from '@/components/ui/button';

const GRID_SIZE = 8;
const BLOCK_COLORS = ['#C41DFA', '#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D'];

export default function BlockBlast({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const [grid, setGrid] = useState<string[][]>(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('')));
  const [pieces, setPieces] = useState<{ id: number, shape: number[][], color: string }[]>([]);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draggingPiece, setDraggingPiece] = useState<{ id: number, shape: number[][], color: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const generateNewPieces = useCallback(() => {
    const availableShapes = [
      [[1]], 
      [[1, 1]], 
      [[1], [1]], 
      [[1, 1], [1, 1]], 
      [[1, 1, 1]], 
      [[1], [1], [1]], 
      [[1, 1, 1], [0, 1, 0]],
      [[1, 0], [1, 1]],
      [[1, 1, 1], [1, 0, 0]],
      [[1, 1, 1], [0, 0, 1]]
    ];
    const newPieces = Array.from({ length: 3 }).map((_, i) => ({
      id: Math.random(),
      shape: availableShapes[Math.floor(Math.random() * availableShapes.length)],
      color: BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)]
    }));
    setPieces(newPieces);
  }, []);

  const fetchLevel = useCallback(async () => {
    setLoading(true);
    try {
      const level = await generateBlockBlastLevel({ difficulty: 'medium' });
      const newGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));
      
      level.initialBlocks.forEach(b => {
        if (b.row < GRID_SIZE && b.col < GRID_SIZE) {
          const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
          newGrid[b.row][b.col] = color;
        }
      });
      setGrid(newGrid);
      generateNewPieces();
    } catch (e) {
      setGrid(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('')));
      generateNewPieces();
    }
    setLoading(false);
  }, [generateNewPieces]);

  useEffect(() => {
    fetchLevel();
  }, [fetchLevel]);

  const canPlace = (shape: number[][], startRow: number, startCol: number, currentGrid: string[][]) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const gridR = startRow + r;
          const gridC = startCol + c;
          if (gridR < 0 || gridR >= GRID_SIZE || gridC < 0 || gridC >= GRID_SIZE || currentGrid[gridR][gridC] !== '') {
            return false;
          }
        }
      }
    }
    return true;
  };

  const findNearestValidPosition = (piece: any, targetRow: number, targetCol: number) => {
    let bestPos = null;
    let minDistance = Infinity;
    const searchRange = 2; // Rayon de recherche pour l'aimantation

    for (let r = targetRow - searchRange; r <= targetRow + searchRange; r++) {
      for (let c = targetCol - searchRange; c <= targetCol + searchRange; c++) {
        if (canPlace(piece.shape, r, c, grid)) {
          const dist = Math.sqrt(Math.pow(r - targetRow, 2) + Math.pow(c - targetCol, 2));
          if (dist < minDistance) {
            minDistance = dist;
            bestPos = { r, c };
          }
        }
      }
    }
    return bestPos;
  };

  const placePiece = (pieceId: number, startRow: number, startCol: number) => {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return false;

    // Chercher la position la plus proche si la position actuelle est invalide
    const bestPos = findNearestValidPosition(piece, startRow, startCol);
    if (!bestPos) return false;

    const finalRow = bestPos.r;
    const finalCol = bestPos.c;

    const newGrid = grid.map(row => [...row]);
    piece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) newGrid[finalRow + r][finalCol + c] = piece.color;
      });
    });

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
      const canMoveAny = updatedPieces.some(p => {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (canPlace(p.shape, r, c, newGrid)) return true;
          }
        }
        return false;
      });
      if (!canMoveAny) onGameOver(score + (linesCleared * 100));
    }
    return true;
  };

  const onDragStart = (piece: any, e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDraggingPiece(piece);
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
    const gridEl = document.getElementById('blast-grid');
    if (gridEl) {
      const rect = gridEl.getBoundingClientRect();
      const cellSize = rect.width / GRID_SIZE;
      
      const gridX = mousePos.x - rect.left;
      const gridY = mousePos.y - rect.top;
      
      const hoveredCol = Math.floor(gridX / cellSize);
      const hoveredRow = Math.floor(gridY / cellSize);

      const shapeRows = draggingPiece.shape.length;
      const shapeCols = draggingPiece.shape[0].length;
      
      // On centre la pièce sur le doigt
      const startRow = hoveredRow - Math.floor(shapeRows / 2);
      const startCol = hoveredCol - Math.floor(shapeCols / 2);
      
      placePiece(draggingPiece.id, startRow, startCol);
    }
    setDraggingPiece(null);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-4 h-full">
      <Loader2 className="animate-spin text-primary h-12 w-12" />
      <p className="font-headline font-bold">L'IA prépare votre grille...</p>
    </div>
  );

  return (
    <div 
      className="flex flex-col items-center gap-8 w-full h-full justify-center touch-none select-none p-4"
      onMouseMove={onDragMove}
      onTouchMove={onDragMove}
      onMouseUp={onDragEnd}
      onTouchEnd={onDragEnd}
    >
      <div className="text-4xl font-headline font-bold text-primary">Score: {score}</div>

      <div 
        id="blast-grid"
        className="grid grid-cols-8 gap-1 bg-muted/20 p-2 rounded-2xl border-4 border-primary shadow-2xl"
        style={{ width: 'min(90vw, 400px)', height: 'min(90vw, 400px)' }}
      >
        {grid.map((row, r) => row.map((cell, c) => (
          <div 
            key={`${r}-${c}`} 
            className="aspect-square rounded-md transition-all duration-300 border border-black/5"
            style={{ backgroundColor: cell || 'rgba(0,0,0,0.03)' }}
          />
        )))}
      </div>

      <div className="flex gap-6 min-h-[140px] items-center">
        {pieces.map((p) => (
          <div 
            key={p.id}
            className={`cursor-grab active:cursor-grabbing transition-transform flex items-center justify-center ${draggingPiece?.id === p.id ? 'fixed z-50 pointer-events-none scale-125' : 'hover:scale-105'}`}
            style={draggingPiece?.id === p.id ? { left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -50%)' } : {}}
            onMouseDown={(e) => onDragStart(p, e)}
            onTouchStart={(e) => onDragStart(p, e)}
          >
            <div className="grid" style={{ 
              gridTemplateRows: `repeat(${p.shape.length}, 1fr)`, 
              gridTemplateColumns: `repeat(${p.shape[0].length}, 1fr)`, 
              gap: '2px' 
            }}>
              {p.shape.map((row, r) => row.map((val, c) => (
                <div 
                  key={`${r}-${c}`} 
                  className="w-8 h-8 rounded-md border border-black/10 shadow-sm"
                  style={{ backgroundColor: val ? p.color : 'transparent', opacity: val ? 1 : 0 }}
                />
              )))}
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-muted-foreground text-sm font-medium bg-muted/50 px-4 py-2 rounded-full">
        Faites glisser les blocs pour remplir les lignes ! (Aimantation automatique incluse)
      </p>

      <Button variant="ghost" size="sm" onClick={fetchLevel} className="mt-2">
        <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
      </Button>
    </div>
  );
}
