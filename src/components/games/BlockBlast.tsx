
"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { generateBlockBlastLevel } from '@/ai/flows/block-blast-level-generator';

const GRID_SIZE = 9;
const BLOCK_COLORS = ['#C41DFA', '#2600CC', '#FA1D64', '#1DFA9E', '#FAC11D'];

export default function BlockBlast({ onGameOver, isMobile }: { onGameOver: (score: number) => void, isMobile: boolean }) {
  const [grid, setGrid] = useState<string[][]>(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('')));
  const [pieces, setPieces] = useState<{ id: number, shape: number[][], color: string }[]>([]);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);
  const [clearingLines, setClearingLines] = useState<{ rows: number[], cols: number[] }>({ rows: [], cols: [] });
  const [draggingPiece, setDraggingPiece] = useState<{ id: number, shape: number[][], color: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const scoreRef = useRef(0);
  const gridRef = useRef<string[][]>([]);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  const generateNewPieces = useCallback(() => {
    const availableShapes = [
      [[1]], 
      [[1, 1]], 
      [[1], [1]], 
      [[1, 1], [1, 1]], 
      [[1, 1, 1]], 
      [[1], [1], [1]], 
      [[1, 1, 1], [0, 1, 0]],
      [[1, 1], [1, 0]],
      [[1, 1, 1], [1, 0, 0]],
      [[1, 1, 1], [0, 0, 1]],
      [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
    ];
    const newPieces = Array.from({ length: 3 }).map((_, i) => ({
      id: Math.random(),
      shape: availableShapes[Math.floor(Math.random() * availableShapes.length)],
      color: BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)]
    }));
    setPieces(newPieces);
    return newPieces;
  }, []);

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

  const checkGameOver = useCallback((currentGrid: string[][], currentPieces: typeof pieces) => {
    if (currentPieces.length === 0) return false;
    const canMoveAny = currentPieces.some(p => {
      for (let r = -2; r < GRID_SIZE; r++) {
        for (let c = -2; c < GRID_SIZE; c++) {
          if (canPlace(p.shape, r, c, currentGrid)) return true;
        }
      }
      return false;
    });
    return !canMoveAny;
  }, []);

  const findNearestValidPosition = (piece: any, targetRow: number, targetCol: number) => {
    let bestPos = null;
    let minDistance = Infinity;
    const searchRange = 2;

    for (let r = targetRow - searchRange; r <= targetRow + searchRange; r++) {
      for (let c = targetCol - searchRange; c <= targetCol + searchRange; c++) {
        if (canPlace(piece.shape, r, c, gridRef.current)) {
          const dist = Math.pow(r - targetRow, 2) + Math.pow(c - targetCol, 2);
          if (dist < minDistance) {
            minDistance = dist;
            bestPos = { r, c };
          }
        }
      }
    }
    return bestPos;
  };

  const startNewGame = useCallback(async () => {
    setLoading(true);
    setIsGameOver(false);
    setScore(0);
    scoreRef.current = 0;
    
    const newGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));
    
    try {
      const level = await generateBlockBlastLevel({ difficulty: 'medium' });
      level.initialBlocks.forEach(b => {
        if (b.row < GRID_SIZE && b.col < GRID_SIZE) {
          const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
          newGrid[b.row][b.col] = color;
        }
      });
    } catch (e) {
      console.log("Mode hors-ligne activé pour Block Blast");
    }

    setGrid(newGrid);
    generateNewPieces();
    setLoading(false);
  }, [generateNewPieces]);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  const placePiece = (pieceId: number, startRow: number, startCol: number) => {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return false;

    const bestPos = findNearestValidPosition(piece, startRow, startCol);
    if (!bestPos) return false;

    const finalRow = bestPos.r;
    const finalCol = bestPos.c;

    const newGrid = gridRef.current.map(row => [...row]);
    let blocksPlaced = 0;
    piece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          newGrid[finalRow + r][finalCol + c] = piece.color;
          blocksPlaced++;
        }
      });
    });

    let moveScore = blocksPlaced * 10;
    
    const rowsToClear: number[] = [];
    const colsToClear: number[] = [];
    for (let r = 0; r < GRID_SIZE; r++) if (newGrid[r].every(cell => cell !== '')) rowsToClear.push(r);
    for (let c = 0; c < GRID_SIZE; c++) if (newGrid.every(row => row[c] !== '')) colsToClear.push(c);

    if (rowsToClear.length > 0 || colsToClear.length > 0) {
      setClearingLines({ rows: rowsToClear, cols: colsToClear });
      
      setTimeout(() => {
        rowsToClear.forEach(r => newGrid[r] = Array(GRID_SIZE).fill(''));
        colsToClear.forEach(c => newGrid.forEach(row => row[c] = ''));

        moveScore += (rowsToClear.length + colsToClear.length) * 100;
        
        const isEmpty = newGrid.every(row => row.every(cell => cell === ''));
        if (isEmpty) moveScore *= 2;

        scoreRef.current += moveScore;
        setScore(scoreRef.current);
        setGrid(newGrid);
        setClearingLines({ rows: [], cols: [] });
        finishTurn(pieceId, newGrid);
      }, 100);
    } else {
      scoreRef.current += moveScore;
      setScore(scoreRef.current);
      setGrid(newGrid);
      finishTurn(pieceId, newGrid);
    }
    return true;
  };

  const finishTurn = (usedPieceId: number, currentGrid: string[][]) => {
    const updatedPieces = pieces.filter(p => p.id !== usedPieceId);
    let finalPieces = updatedPieces;

    if (updatedPieces.length === 0) {
      finalPieces = generateNewPieces();
    } else {
      setPieces(updatedPieces);
    }

    if (checkGameOver(currentGrid, finalPieces)) {
      setIsGameOver(true);
      onGameOver(scoreRef.current);
    }
  };

  const onDragStart = (piece: any, e: React.MouseEvent | React.TouchEvent) => {
    if (isGameOver) return;
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
      
      const startRow = hoveredRow - Math.floor(draggingPiece.shape.length / 2);
      const startCol = hoveredCol - Math.floor(draggingPiece.shape[0].length / 2);
      
      placePiece(draggingPiece.id, startRow, startCol);
    }
    setDraggingPiece(null);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-4 h-full">
      <Loader2 className="animate-spin text-primary h-12 w-12" />
      <p className="font-headline font-bold">Préparation du plateau...</p>
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
      <div className="text-4xl font-headline font-bold text-primary drop-shadow-sm italic tracking-tighter">SCORE: {score}</div>

      <div className="relative">
        <div 
          id="blast-grid"
          className="grid gap-[4px] bg-slate-800 p-[4px] rounded-none border-[6px] border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          style={{ 
            width: 'min(90vw, 450px)', 
            height: 'min(90vw, 450px)',
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` 
          }}
        >
          {grid.map((row, r) => row.map((cell, c) => {
            const isClearing = clearingLines.rows.includes(r) || clearingLines.cols.includes(c);
            return (
              <div 
                key={`${r}-${c}`} 
                className={cn(
                  "aspect-square rounded-none transition-all",
                  isClearing ? "animate-pulse brightness-200 scale-90" : "duration-200"
                )}
                style={{ backgroundColor: cell || '#1e293b' }}
              />
            );
          }))}
        </div>

        {isGameOver && (
          <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center p-4 text-center z-20 backdrop-blur-md rounded-none">
            <h2 className="text-5xl font-headline font-bold text-destructive mb-4 tracking-tighter italic">GAME OVER</h2>
            <p className="text-2xl font-bold mb-8">Score Final: {score}</p>
            <button onClick={startNewGame} className="bg-primary text-white rounded-none px-12 py-6 text-xl font-bold shadow-2xl hover:scale-105 transition-transform flex items-center italic">
              <RotateCcw className="mr-3 h-6 w-6" /> REJOUER
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6 min-h-[140px] items-center justify-center w-full">
        {pieces.map((p) => (
          <div 
            key={p.id}
            className={cn(
              "cursor-grab active:cursor-grabbing transition-transform flex items-center justify-center",
              draggingPiece?.id === p.id ? 'fixed z-50 pointer-events-none scale-125' : 'hover:scale-110'
            )}
            style={draggingPiece?.id === p.id ? { left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -50%)' } : {}}
            onMouseDown={(e) => onDragStart(p, e)}
            onTouchStart={(e) => onDragStart(p, e)}
          >
            <div className="grid" style={{ 
              gridTemplateRows: `repeat(${p.shape.length}, 1fr)`, 
              gridTemplateColumns: `repeat(${p.shape[0].length}, 1fr)`, 
              gap: '3px' 
            }}>
              {p.shape.map((row, r) => row.map((val, c) => (
                <div 
                  key={`${r}-${c}`} 
                  className="w-7 h-7 md:w-8 md:h-8 rounded-none border border-white/5 shadow-inner"
                  style={{ backgroundColor: val ? p.color : 'transparent', opacity: val ? 1 : 0 }}
                />
              )))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <p className="text-muted-foreground text-xs font-black bg-muted/50 px-6 py-2 rounded-none uppercase tracking-widest border border-white/5">
          SCORE X2 SI GRILLE VIDE
        </p>
        <Button variant="ghost" size="sm" onClick={startNewGame} className="text-muted-foreground hover:text-primary rounded-none">
          <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
        </Button>
      </div>
    </div>
  );
}
