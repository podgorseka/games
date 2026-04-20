
"use client"

import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Box, 
  CircleDot, 
  Bird, 
  MoveRight, 
  Grid3X3, 
  ArrowUpRight,
  X,
  Keyboard
} from 'lucide-react';
import GameCard from '@/components/GameCard';
import Leaderboard from '@/components/Leaderboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPlayerName, savePlayerName, saveScore } from '@/lib/storage';
import { AuthButton } from '@/components/AuthButton';
import { useUser } from '@/firebase';

// Game components
import Snake from '@/components/games/Snake';
import Tetris from '@/components/games/Tetris';
import FlappyBird from '@/components/games/FlappyBird';
import BlockBlast from '@/components/games/BlockBlast';
import PlatformerCube from '@/components/games/PlatformerCube';
import Pong from '@/components/games/Pong';

const GAMES = [
  { id: 'block-blast', name: 'Block Blast', description: 'Place blocks and explode full lines', icon: <Box /> },
  { id: 'platformer-cube', name: 'Platformer Cube', description: 'Jump over obstacles with your cube buddy', icon: <MoveRight /> },
  { id: 'snake', name: 'Snake', description: 'Classic snake game with smooth controls', icon: <CircleDot /> },
  { id: 'tetris', name: 'Tetris', description: 'Classic brick breaking strategy', icon: <Grid3X3 /> },
  { id: 'flappy-bird', name: 'Flappy Bird', description: 'Tap to fly between moving pillars', icon: <Bird /> },
  { id: 'pong', name: 'Pong', description: 'Solo pong against an AI paddle', icon: <Gamepad2 /> },
];

export default function Home() {
  const isMobile = useIsMobile();
  const { user } = useUser();
  const [playerName, setPlayerName] = useState('');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.displayName) {
      setPlayerName(user.displayName);
      savePlayerName(user.displayName);
    } else {
      setPlayerName(getPlayerName());
    }
  }, [user]);

  const handlePlayClick = (gameId: string) => {
    setSelectedGameId(gameId);
    if (!playerName && !user) {
      setShowNameDialog(true);
    } else {
      setActiveGameId(gameId);
    }
  };

  const handleStartGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      savePlayerName(playerName);
      setShowNameDialog(false);
      setActiveGameId(selectedGameId);
    }
  };

  const handleGameOver = (score: number) => {
    if (activeGameId) {
      const game = GAMES.find(g => g.id === activeGameId);
      if (game) {
        saveScore(playerName || user?.displayName || 'Anonyme', activeGameId, game.name, score);
      }
    }
  };

  const renderGame = () => {
    switch (activeGameId) {
      case 'snake': return <Snake isMobile={isMobile} onGameOver={handleGameOver} />;
      case 'tetris': return <Tetris isMobile={isMobile} onGameOver={handleGameOver} />;
      case 'flappy-bird': return <FlappyBird isMobile={isMobile} onGameOver={handleGameOver} />;
      case 'block-blast': return <BlockBlast isMobile={isMobile} onGameOver={handleGameOver} />;
      case 'platformer-cube': return <PlatformerCube isMobile={isMobile} onGameOver={handleGameOver} />;
      case 'pong': return <Pong isMobile={isMobile} onGameOver={handleGameOver} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-xl">
              <Gamepad2 className="text-white h-6 w-6" />
            </div>
            <h1 className="text-2xl font-headline font-bold tracking-tight text-primary">GAME ZONE</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <AuthButton />
            <Button 
              variant="outline" 
              className="hidden sm:flex rounded-full border-primary text-primary hover:bg-primary hover:text-white transition-all font-bold"
              asChild
            >
              <a href="https://adrienn.fr" target="_blank" rel="noopener noreferrer">
                ADRIENN.FR <ArrowUpRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16 space-y-4">
          <h2 className="text-5xl md:text-7xl font-headline font-bold text-foreground tracking-tighter">
            YOUR ULTIMATE <span className="text-primary italic">PLAYGROUND</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience 6 addictive mini-games designed for both desktop and mobile. 
            Connect to save your progress!
          </p>
        </section>

        {/* Game Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {GAMES.map((game) => (
            <GameCard 
              key={game.id}
              id={game.id}
              name={game.name}
              description={game.description}
              icon={game.icon}
              onPlay={handlePlayClick}
            />
          ))}
        </div>

        {/* Leaderboard */}
        <section className="mt-20">
          <Leaderboard />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-12 border-t">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-headline font-bold mb-2">GAME ZONE</h3>
            <p className="text-sm text-muted-foreground">© 2024 Built with precision and style.</p>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" size="sm" asChild>
              <a href="https://adrienn.fr">Contact</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://adrienn.fr">Support</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://adrienn.fr">Privacy</a>
            </Button>
          </div>
        </div>
      </footer>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">What's your name?</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStartGame} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Enter your pilot name</Label>
              <Input 
                id="name" 
                placeholder="Game Master..." 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)}
                className="rounded-xl h-12"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold">Start Playing</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Game Modal */}
      {activeGameId && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          <header className="h-16 px-4 flex items-center justify-between border-b bg-card">
            <div className="flex items-center gap-2">
              <Gamepad2 className="text-primary h-6 w-6" />
              <span className="font-headline font-bold text-lg uppercase tracking-wider">
                {GAMES.find(g => g.id === activeGameId)?.name}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {!isMobile && (
                 <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground mr-4">
                   <Keyboard className="h-4 w-4" /> Use arrow keys / space
                 </div>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-destructive hover:text-white"
                onClick={() => setActiveGameId(null)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </header>
          <div className="flex-grow relative bg-[#FDFCFE]">
            {renderGame()}
          </div>
        </div>
      )}
    </div>
  );
}
