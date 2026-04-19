"use client"

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

interface GameCardProps {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  onPlay: (id: string) => void;
}

export default function GameCard({ id, name, description, icon, onPlay }: GameCardProps) {
  return (
    <Card className="group relative overflow-hidden border-2 border-transparent hover:border-primary transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl bg-white flex flex-col h-full">
      <div className="absolute top-0 left-0 w-full h-1 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
      
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-3 rounded-2xl bg-muted group-hover:bg-primary/10 transition-colors duration-300">
          {React.cloneElement(icon as React.ReactElement, { className: 'h-8 w-8 text-primary' })}
        </div>
        <div>
          <CardTitle className="font-headline text-xl group-hover:text-primary transition-colors">{name}</CardTitle>
          <CardDescription className="line-clamp-1">{description}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
      </CardContent>

      <CardFooter className="pt-0">
        <Button 
          className="w-full font-bold group-hover:bg-secondary group-hover:text-white transition-all rounded-xl"
          onClick={() => onPlay(id)}
        >
          <Play className="mr-2 h-4 w-4 fill-current" /> Play Now
        </Button>
      </CardFooter>
    </Card>
  );
}
