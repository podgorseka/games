
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
  Keyboard,
  User as UserIcon,
  Car
} from 'lucide-react';
import GameCard from '@/components/GameCard';
import Leaderboard from '@/components/Leaderboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPlayerName, savePlayerName, saveScore } from '@/lib/storage';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Game components
import Snake from '@/components/games/Snake';
import Tetris from '@/components/games/Tetris';
import FlappyBird from '@/components/games/FlappyBird';
import BlockBlast from '@/components/games/BlockBlast';
import PlatformerCube from '@/components/games/PlatformerCube';
import Pong from '@/components/games/Pong';
import ApexRacer from '@/components/games/MrRacer';

const GAMES = [
  { id: 'apex-racer', name: 'Apex Racer', description: 'Course de haute précision sur autoroute nocturne', icon: <Car /> },
  { id: 'block-blast', name: 'Block Blast', description: 'Placez des blocs et faites exploser les lignes', icon: <Box /> },
  { id: 'platformer-cube', name: 'Platformer Cube', description: 'Sautez par-dessus les obstacles avec style', icon: <MoveRight /> },
  { id: 'snake', name: 'Snake', description: 'Le serpent classique avec des contrôles fluides', icon: <CircleDot /> },
  { id: 'tetris', name: 'Tetris', description: 'Stratégie de briques classique', icon: <Grid3X3 /> },
  { id: 'flappy-bird', name: 'Flappy Bird', description: 'Volez entre les piliers mouvants', icon: <Bird /> },
  { id: 'pong', name: 'Pong', description: 'Pong en solo contre une IA', icon: <Gamepad2 /> },
];

export default function Home() {
  const isMobile = useIsMobile();
  const [playerName, setPlayerName] = useState('');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerName(getPlayerName());
  }, []);

  const handlePlayClick = (gameId: string) => {
    setSelectedGameId(gameId);
    if (!playerName) {
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
      if (selectedGameId) {
        setActiveGameId(selectedGameId);
      }
    }
  };

  const handleGameOver = (score: number) => {
    if (activeGameId) {
      const game = GAMES.find(g => g.id === activeGameId);
      if (game) {
        saveScore(playerName || 'Anonyme', activeGameId, game.name, score);
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
      case 'apex-racer': return <ApexRacer isMobile={isMobile} onGameOver={handleGameOver} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-xl">
              <Gamepad2 className="text-white h-6 w-6" />
            </div>
            <h1 className="text-2xl font-headline font-bold tracking-tight text-primary">GAME ZONE</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {playerName && (
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 rounded-full"
                onClick={() => setShowNameDialog(true)}
              >
                <Avatar className="h-8 w-8 border border-primary">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {playerName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline font-medium text-sm">{playerName}</span>
              </Button>
            )}
            {!playerName && (
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="rounded-full font-bold"
                 onClick={() => setShowNameDialog(true)}
               >
                 <UserIcon className="h-4 w-4 mr-2" />
                 Set Name
               </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-12">
        <section className="text-center mb-16 space-y-4">
          <h2 className="text-5xl md:text-7xl font-headline font-bold text-foreground tracking-tighter">
            YOUR ULTIMATE <span className="text-primary italic">PLAYGROUND</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Découvrez nos mini-jeux addictifs conçus pour desktop et mobile. 
            Tous vos scores sont sauvegardés localement !
          </p>
        </section>

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

        <section className="mt-20">
          <Leaderboard />
        </section>
      </main>

      <footer className="bg-muted py-12 border-t">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-headline font-bold mb-2">GAME ZONE</h3>
            <p className="text-sm text-muted-foreground">© 2024 Design & Performance. 100% Offline.</p>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" size="sm">Contact</Button>
            <Button variant="ghost" size="sm">Support</Button>
            <Button variant="ghost" size="sm">Privacy</Button>
          </div>
        </div>
      </footer>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">Quel est votre nom ?</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStartGame} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Entrez votre nom de pilote</Label>
              <Input 
                id="name" 
                placeholder="Game Master..." 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)}
                className="rounded-xl h-12"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold">Sauvegarder & Jouer</Button>
          </form>
        </DialogContent>
      </Dialog>

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
                   <Keyboard className="h-4 w-4" /> Utilisez les flèches / espace
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
          <div className="flex-grow relative bg-[#020617]">
            {renderGame()}
          </div>
        </div>
      )}
    </div>
  );
}
