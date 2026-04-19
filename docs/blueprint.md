# **App Name**: Game Zone

## Core Features:

- Game Discovery Grid: A responsive main page displaying a grid of cards, each representing a mini-game. Each card will show the game's icon, name, a brief description, and a 'Play' button. Includes stylish hover/tap animations.
- Mini-Game Implementations: Integration of six distinct mini-games: Block Blast, Geometry Dash, Snake, Tetris, Flappy Bird, and Pong, with core game logic implemented for desktop play.
- Mobile Touch Controls: Automatic detection of mobile devices to display game-specific on-screen touch buttons and controls. This includes a large tap zone for Geometry Dash and Flappy Bird, 4-directional arrows for Snake, action buttons (move, rotate, drop) for Tetris, up/down buttons for Pong, and touch-based drag-and-drop for Block Blast. Controls are responsive and feel natural on small screens, and hidden on desktop.
- Fullscreen Game Modals: Each mini-game launches within a fullscreen modal overlay for an immersive gaming experience, ensuring the entire screen is dedicated to gameplay.
- Local Score Leaderboard: A global leaderboard table displayed below the game grid, featuring columns for Rank, Player Name, Game, and Score. All game scores are saved and retrieved from localStorage, allowing players to enter their name before submitting a score.
- Dynamic Block Blast Level Tool: An AI tool that generates unique initial block configurations and challenges for the 'Block Blast' game, providing variety and extending replayability.
- ADRIENN.FR Redirect Button: A prominent button labeled 'ADRIENN.FR' placed in either the header or footer, redirecting users to 'https://adrienn.fr' when clicked.

## Style Guidelines:

- Light color scheme to ensure vibrancy and clarity, with a primary color of vibrant magenta-purple (#C41DFA) to evoke creativity and excitement.
- Background color of very light, desaturated magenta (#F7F0F9), providing a subtle hint of the primary hue without distracting from content.
- Accent color of deep indigo (#2600CC), offering a strong, contrasting highlight for interactive elements and key information.
- Headline font: 'Space Grotesk' (sans-serif), for a modern, slightly techy and engaging feel for game titles and prominent text.
- Body text font: 'Inter' (sans-serif), ensuring readability and a neutral, objective feel for descriptions, instructions, and leaderboard entries.
- Modern, clean, vector-based icons that visually represent each game, enhancing recognizability and thematic consistency.
- A fully responsive grid-based layout for the main game selection, adapting seamlessly to all screen sizes, and ensuring an immersive full-screen experience for individual games in modals. No sidebar present.
- Subtle, fluid animations for game card hovers/taps, smooth transitions for modal openings and closings, and clear visual feedback animations within each mini-game.