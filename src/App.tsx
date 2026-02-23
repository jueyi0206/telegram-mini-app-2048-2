/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

 import React, { useState, useEffect, useCallback, useRef } from 'react';
 import { motion, AnimatePresence } from 'motion/react';
 import { RefreshCw, Share2, Trophy } from 'lucide-react';
 
 // --- Types & Interfaces ---
 
 interface Tile {
   id: number;
   value: number;
   x: number;
   y: number;
   mergedFrom?: Tile[]; // For animation tracking
 }
 
 type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
 
 // Telegram WebApp Type Definition (Simplified)
 declare global {
   interface Window {
     Telegram: {
       WebApp: {
         ready: () => void;
         expand: () => void;
         close: () => void;
         MainButton: {
           text: string;
           show: () => void;
           hide: () => void;
           onClick: (cb: () => void) => void;
         };
         HapticFeedback: {
           impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
           notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
         };
         openTelegramLink: (url: string) => void;
         themeParams: {
           bg_color?: string;
           text_color?: string;
           hint_color?: string;
           button_color?: string;
           button_text_color?: string;
           secondary_bg_color?: string;
         };
         initDataUnsafe?: {
           user?: {
             first_name?: string;
             username?: string;
           };
         };
       };
     };
   }
 }
 
 // --- Constants ---
 
 const GRID_SIZE = 4;
 const CELL_GAP = 12; // px
 const ANIMATION_DURATION = 0.2; // seconds
 
 // Color Palette for Tiles (You can change these!)
 const TILE_COLORS: Record<number, string> = {
   2: 'bg-slate-200 text-slate-800',
   4: 'bg-slate-300 text-slate-800',
   8: 'bg-orange-200 text-orange-800',
   16: 'bg-orange-300 text-orange-900',
   32: 'bg-orange-400 text-white',
   64: 'bg-orange-500 text-white',
   128: 'bg-yellow-400 text-white shadow-[0_0_10px_rgba(250,204,21,0.4)]',
   256: 'bg-yellow-500 text-white shadow-[0_0_15px_rgba(234,179,8,0.5)]',
   512: 'bg-yellow-600 text-white shadow-[0_0_20px_rgba(202,138,4,0.6)]',
   1024: 'bg-yellow-700 text-white shadow-[0_0_25px_rgba(161,98,7,0.7)]',
   2048: 'bg-yellow-800 text-white shadow-[0_0_30px_rgba(133,77,14,0.8)]',
 };
 
 // --- Helper Functions ---
 
 const getEmptyCells = (tiles: Tile[]) => {
   const cells: { x: number; y: number }[] = [];
   for (let x = 0; x < GRID_SIZE; x++) {
     for (let y = 0; y < GRID_SIZE; y++) {
       if (!tiles.find((t) => t.x === x && t.y === y)) {
         cells.push({ x, y });
       }
     }
   }
   return cells;
 };
 
 const getRandomEmptyCell = (tiles: Tile[]) => {
   const emptyCells = getEmptyCells(tiles);
   if (emptyCells.length === 0) return null;
   return emptyCells[Math.floor(Math.random() * emptyCells.length)];
 };
 
 // --- Main Component ---
 
 export default function App() {
   // Unified Game State
   const [gameState, setGameState] = useState<{
     tiles: Tile[];
     score: number;
     gameOver: boolean;
     bestScore: number;
   }>({
     tiles: [],
     score: 0,
     gameOver: false,
     bestScore: 0,
   });
 
   const touchStart = useRef<{ x: number; y: number } | null>(null);
   const initialized = useRef(false);
 
   // 1. Initialization & Telegram Integration
   useEffect(() => {
     if (initialized.current) return;
     initialized.current = true;
 
     // Load Best Score
     const savedBest = localStorage.getItem('2048-best-score');
     const initialBest = savedBest ? parseInt(savedBest, 10) : 0;
 
     setGameState(prev => ({ ...prev, bestScore: initialBest }));
 
     // Initialize Telegram WebApp
     if (window.Telegram?.WebApp) {
       window.Telegram.WebApp.ready();
       window.Telegram.WebApp.expand();
     }
 
     startNewGame();
   }, []);
 
   // Save Best Score
   useEffect(() => {
     if (gameState.score > gameState.bestScore) {
       setGameState(prev => ({ ...prev, bestScore: gameState.score }));
       localStorage.setItem('2048-best-score', gameState.score.toString());
     }
   }, [gameState.score, gameState.bestScore]);
 
   // 2. Game Logic
 
   const startNewGame = () => {
     triggerHaptic('medium');
 
     const newTiles: Tile[] = [];
     let currentId = Date.now();
     
     const addTile = (existingTiles: Tile[]) => {
       const cell = getRandomEmptyCell(existingTiles);
       if (cell) {
         newTiles.push({
           id: currentId + Math.random(),
           value: Math.random() < 0.9 ? 2 : 4,
           x: cell.x,
           y: cell.y,
         });
       }
     };
 
     addTile(newTiles);
     addTile(newTiles);
     
     setGameState(prev => ({
       ...prev,
       tiles: newTiles,
       score: 0,
       gameOver: false,
     }));
   };
 
   const move = useCallback((direction: Direction) => {
     setGameState((prevState) => {
       if (prevState.gameOver) return prevState;
 
       const tiles = prevState.tiles.map(t => ({ ...t })); // Deep clone
       let moved = false;
       let score = prevState.score;
       
       // Sort tiles based on direction
       tiles.sort((a, b) => {
         if (direction === 'UP') return a.y - b.y;
         if (direction === 'DOWN') return b.y - a.y;
         if (direction === 'LEFT') return a.x - b.x;
         if (direction === 'RIGHT') return b.x - a.x;
         return 0;
       });
 
       const mergedIds = new Set<number>();
 
       for (let i = 0; i < tiles.length; i++) {
         const tile = tiles[i];
         let { x, y } = tile;
         let nextX = x;
         let nextY = y;
 
         const dx = direction === 'LEFT' ? -1 : direction === 'RIGHT' ? 1 : 0;
         const dy = direction === 'UP' ? -1 : direction === 'DOWN' ? 1 : 0;
 
         while (true) {
           const checkX = nextX + dx;
           const checkY = nextY + dy;
 
           if (checkX < 0 || checkX >= GRID_SIZE || checkY < 0 || checkY >= GRID_SIZE) break;
 
           const obstacle = tiles.find((t) => t.x === checkX && t.y === checkY);
 
           if (obstacle) {
             if (
               obstacle.value === tile.value &&
               !mergedIds.has(obstacle.id) &&
               !mergedIds.has(tile.id)
             ) {
               const newValue = tile.value * 2;
               score += newValue;
               
               mergedIds.add(obstacle.id);
               obstacle.value = newValue;
               obstacle.mergedFrom = [tile, { ...obstacle }];
               
               tiles.splice(i, 1);
               i--;
               
               moved = true;
               triggerHaptic('medium');
             }
             break;
           }
 
           nextX = checkX;
           nextY = checkY;
         }
 
         if (nextX !== x || nextY !== y) {
           tile.x = nextX;
           tile.y = nextY;
           moved = true;
         }
       }
 
       if (!moved) return prevState;
 
       const emptyCells = getEmptyCells(tiles);
       if (emptyCells.length > 0) {
         const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
         tiles.push({
           id: Date.now() + Math.random(),
           value: Math.random() < 0.9 ? 2 : 4,
           x: cell.x,
           y: cell.y,
         });
       }
 
       const gameOver = emptyCells.length === 0 && !canMove(tiles);
       if (gameOver) triggerHaptic('error');
 
       return {
         ...prevState,
         tiles,
         score,
         gameOver,
       };
     });
   }, []);
 
   // Helper to check if any moves are possible
   const canMove = (currentTiles: Tile[]) => {
     for (const tile of currentTiles) {
       for (const dir of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
         const neighbor = currentTiles.find(t => t.x === tile.x + dir[0] && t.y === tile.y + dir[1]);
         if (!neighbor || neighbor.value === tile.value) return true;
       }
     }
     return false;
   };
 
   // 3. Input Handling
 
   // Keyboard
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       switch (e.key) {
         case 'ArrowUp': move('UP'); break;
         case 'ArrowDown': move('DOWN'); break;
         case 'ArrowLeft': move('LEFT'); break;
         case 'ArrowRight': move('RIGHT'); break;
         default: return;
       }
       e.preventDefault();
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [move]);
 
   // Touch / Swipe
   const handleTouchStart = (e: React.TouchEvent) => {
     touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
   };
 
   const handleTouchEnd = (e: React.TouchEvent) => {
     if (!touchStart.current) return;
     const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
     
     const dx = touchEnd.x - touchStart.current.x;
     const dy = touchEnd.y - touchStart.current.y;
     
     const absDx = Math.abs(dx);
     const absDy = Math.abs(dy);
 
     if (Math.max(absDx, absDy) > 30) { // Threshold
       if (absDx > absDy) {
         move(dx > 0 ? 'RIGHT' : 'LEFT');
       } else {
         move(dy > 0 ? 'DOWN' : 'UP');
       }
     }
     touchStart.current = null;
   };
 
   // 4. Telegram Helpers
   const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'error') => {
     if (window.Telegram?.WebApp?.HapticFeedback) {
       if (style === 'error') {
         window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
       } else {
         window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
       }
     }
   };
 
   const shareScore = () => {
     const text = `I scored ${gameState.score} in 2048! Can you beat me?`;
     const url = "https://t.me/share/url?url=" + encodeURIComponent(window.location.href) + "&text=" + encodeURIComponent(text);
     if (window.Telegram?.WebApp?.openTelegramLink) {
       window.Telegram.WebApp.openTelegramLink(url);
     } else {
       window.open(url, '_blank');
     }
   };
 
   // 5. Render
 
   return (
     <div 
       className="min-h-screen bg-neutral-900 text-white font-sans flex flex-col items-center justify-center p-4 select-none touch-none"
       onTouchStart={handleTouchStart}
       onTouchEnd={handleTouchEnd}
     >
       {/* Header */}
       <div className="w-full max-w-sm mb-6 flex justify-between items-center">
         <div>
           <h1 className="text-4xl font-bold text-neutral-100">2048</h1>
           <p className="text-neutral-400 text-sm">Join the numbers!</p>
         </div>
         <div className="flex gap-3">
           <div className="bg-neutral-800 p-2 rounded-lg text-center min-w-[70px]">
             <div className="text-xs text-neutral-400 uppercase font-bold">Score</div>
             <div className="font-bold text-lg">{gameState.score}</div>
           </div>
           <div className="bg-neutral-800 p-2 rounded-lg text-center min-w-[70px]">
             <div className="text-xs text-neutral-400 uppercase font-bold">Best</div>
             <div className="font-bold text-lg">{gameState.bestScore}</div>
           </div>
         </div>
       </div>
 
       {/* Controls / Actions */}
       <div className="w-full max-w-sm mb-6 flex justify-end gap-3">
         <button 
           onClick={shareScore}
           className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors active:scale-95"
           aria-label="Share Score"
         >
           <Share2 size={20} />
         </button>
         <button 
           onClick={startNewGame}
           className="p-2 bg-neutral-700 rounded-lg hover:bg-neutral-600 transition-colors active:scale-95"
           aria-label="Restart Game"
         >
           <RefreshCw size={20} />
         </button>
       </div>
 
       {/* Game Grid */}
       <div 
         className="relative bg-neutral-800 rounded-xl p-3 shadow-2xl overflow-hidden"
         style={{
           width: 'min(90vw, 400px)',
           height: 'min(90vw, 400px)',
         }}
       >
         {/* Background Grid Cells */}
         <div 
           className="grid grid-cols-4 grid-rows-4 gap-3 w-full h-full"
         >
           {Array.from({ length: 16 }).map((_, i) => (
             <div key={i} className="bg-neutral-700/50 rounded-lg w-full h-full" />
           ))}
         </div>
 
         {/* Active Tiles */}
         <div className="absolute inset-0 p-3">
           <AnimatePresence>
             {gameState.tiles.map((tile) => (
               <motion.div
                 key={tile.id}
                 layout // Use layout prop instead of layoutId for simpler position transitions
                 initial={{ scale: 0, opacity: 0 }}
                 animate={{ 
                   scale: 1, 
                   opacity: 1,
                 }}
                 exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
                 style={{
                   position: 'absolute',
                   width: `calc((100% - ${3 * CELL_GAP}px) / 4)`,
                   height: `calc((100% - ${3 * CELL_GAP}px) / 4)`,
                   left: `calc(12px + ${tile.x} * ((100% - 24px - 36px) / 4 + 12px))`,
                   top: `calc(12px + ${tile.y} * ((100% - 24px - 36px) / 4 + 12px))`,
                 }}
                 transition={{ 
                   type: 'spring', 
                   stiffness: 500, 
                   damping: 30,
                   duration: ANIMATION_DURATION 
                 }}
                 className={`rounded-lg flex items-center justify-center font-bold text-2xl md:text-3xl select-none z-10 ${
                   TILE_COLORS[tile.value] || 'bg-neutral-900 text-white'
                 }`}
               >
                 {tile.value}
               </motion.div>
             ))}
           </AnimatePresence>
         </div>
 
         {/* Game Over Overlay */}
         {gameState.gameOver && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-20"
           >
             <h2 className="text-3xl font-bold text-white mb-2">Game Over!</h2>
             <p className="text-neutral-300 mb-6">Final Score: {gameState.score}</p>
             <button 
               onClick={startNewGame}
               className="px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-500 transition-transform active:scale-95 shadow-lg flex items-center gap-2"
             >
               <RefreshCw size={20} />
               Try Again
             </button>
           </motion.div>
         )}
       </div>
       
       <p className="mt-8 text-neutral-500 text-xs text-center">
         Swipe or use arrow keys to move.
         <br />
         Built with ❤️ for Telegram.
       </p>
     </div>
   );
 }