
"use client"

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

interface GameCardProps {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  onPlay: (id: string) => void;
}

export default function GameCard({ id, name, description, icon, onPlay }: GameCardProps) {
  const imageData = PlaceHolderImages.find(img => img.id === id);

  return (
    <Card className="group relative overflow-hidden border-2 border-transparent hover:border-primary transition-all duration-500 transform hover:-translate-y-2 hover:shadow-2xl bg-white flex flex-col h-full">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 z-10" />
      
      <div className="relative h-48 w-full overflow-hidden">
        {imageData && (
          <Image 
            src={imageData.imageUrl} 
            alt={name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            data-ai-hint={imageData.imageHint}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
           <div className="bg-primary/20 backdrop-blur-md p-2 rounded-xl border border-white/20">
              {React.cloneElement(icon as React.ReactElement, { className: 'h-6 w-6 text-white' })}
           </div>
        </div>
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-2xl group-hover:text-primary transition-colors tracking-tight">{name}</CardTitle>
        <CardDescription className="line-clamp-1 text-sm uppercase tracking-widest font-bold opacity-70">{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-grow pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>
      </CardContent>

      <CardFooter className="pt-4 border-t border-muted/30">
        <Button 
          className="w-full font-bold text-lg h-12 group-hover:bg-primary group-hover:text-white transition-all rounded-2xl shadow-lg hover:shadow-primary/40"
          onClick={() => onPlay(id)}
        >
          <Play className="mr-2 h-5 w-5 fill-current" /> PLAY NOW
        </Button>
      </CardFooter>
    </Card>
  );
}
