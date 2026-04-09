import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import { Crown, Sparkles, Bot, User, RefreshCw } from 'lucide-react';

type Piece = 0 | 1 | 2 | 3 | 4;
type Board = Piece[][];
type Position = { r: number; c: number };
type Move = {
  from: Position;
  to: Position;
  captured?: Position[];
};

const INITIAL_BOARD: Board = [
  [0, 2, 0, 2, 0, 2, 0, 2],
  [2, 0, 2, 0, 2, 0, 2, 0],
  [0, 2, 0, 2, 0, 2, 0, 2],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 1, 0, 1, 0, 1, 0],
  [0, 1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 0],
];

function getValidMoves(board: Board, player: 1 | 2, mustJumpPiece?: Position | null): Move[] {
  const moves: Move[] = [];
  const jumps: Move[] = [];
  
  const isOpponent = (p: Piece, player: 1 | 2) => player === 1 ? (p === 2 || p === 4) : (p === 1 || p === 3);
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (mustJumpPiece && (r !== mustJumpPiece.r || c !== mustJumpPiece.c)) continue;
      
      const piece = board[r][c];
      if (piece === 0) continue;
      if (player === 1 && piece !== 1 && piece !== 3) continue;
      if (player === 2 && piece !== 2 && piece !== 4) continue;
      
      const dirs = [];
      if (piece === 1) dirs.push({dr: -1, dc: -1}, {dr: -1, dc: 1});
      else if (piece === 2) dirs.push({dr: 1, dc: -1}, {dr: 1, dc: 1});
      else if (piece === 3 || piece === 4) dirs.push({dr: -1, dc: -1}, {dr: -1, dc: 1}, {dr: 1, dc: -1}, {dr: 1, dc: 1});
      
      for (const dir of dirs) {
        const nr = r + dir.dr;
        const nc = c + dir.dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (board[nr][nc] === 0 && !mustJumpPiece) {
            moves.push({ from: {r, c}, to: {r: nr, c: nc} });
          } else if (isOpponent(board[nr][nc], player)) {
            const jr = nr + dir.dr;
            const jc = nc + dir.dc;
            if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && board[jr][jc] === 0) {
               jumps.push({ from: {r, c}, to: {r: jr, c: jc}, captured: [{r: nr, c: nc}] });
            }
          }
        }
      }
    }
  }
  
  if (jumps.length > 0) return jumps;
  return mustJumpPiece ? [] : moves;
}

function applyMove(board: Board, move: Move): { newBoard: Board, becameKing: boolean } {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[move.from.r][move.from.c];
  newBoard[move.from.r][move.from.c] = 0;
  newBoard[move.to.r][move.to.c] = piece;
  
  if (move.captured) {
    for (const cap of move.captured) {
      newBoard[cap.r][cap.c] = 0;
    }
  }
  
  let becameKing = false;
  if (piece === 1 && move.to.r === 0) {
    newBoard[move.to.r][move.to.c] = 3;
    becameKing = true;
  } else if (piece === 2 && move.to.r === 7) {
    newBoard[move.to.r][move.to.c] = 4;
    becameKing = true;
  }
  
  return { newBoard, becameKing };
}

function checkWinner(board: Board): 1 | 2 | null {
  let p1Count = 0;
  let p2Count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 1 || board[r][c] === 3) p1Count++;
      if (board[r][c] === 2 || board[r][c] === 4) p2Count++;
    }
  }
  if (p1Count === 0) return 2;
  if (p2Count === 0) return 1;
  return null;
}

export default function App() {
  const [board, setBoard] = useState<Board>(INITIAL_BOARD);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [mustJumpPiece, setMustJumpPiece] = useState<Position | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [isGeminiThinking, setIsGeminiThinking] = useState(false);
  const [geminiThoughts, setGeminiThoughts] = useState<string>("");

  const validMoves = getValidMoves(board, turn, mustJumpPiece);
  
  useEffect(() => {
    if (validMoves.length === 0 && !winner) {
      setWinner(turn === 1 ? 2 : 1);
    }
  }, [validMoves, turn, winner]);

  const handleMove = useCallback((move: Move) => {
    const { newBoard, becameKing } = applyMove(board, move);
    setBoard(newBoard);
    setSelectedPiece(null);
    
    const win = checkWinner(newBoard);
    if (win) {
      setWinner(win);
      return;
    }
    
    let nextTurn = turn;
    let nextMustJump = null;
    
    if (move.captured && !becameKing) {
      const moreJumps = getValidMoves(newBoard, turn, move.to);
      if (moreJumps.length > 0) {
        nextMustJump = move.to;
      } else {
        nextTurn = turn === 1 ? 2 : 1;
      }
    } else {
      nextTurn = turn === 1 ? 2 : 1;
    }
    
    setTurn(nextTurn);
    setMustJumpPiece(nextMustJump);
  }, [board, turn]);

  useEffect(() => {
    if (turn === 2 && !winner && validMoves.length > 0 && !isGeminiThinking) {
      const playGemini = async () => {
        setIsGeminiThinking(true);
        setGeminiThoughts("Analyzing board state...");
        
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const prompt = `You are playing checkers as Player 2 (Blue). You move DOWN the board.
Current board state:
${board.map(row => row.join(',')).join('\n')}
0 = empty
1 = Player 1 (Red, opponent)
2 = Player 2 (Blue, you)
3 = Player 1 King
4 = Player 2 King

Valid moves for you:
${validMoves.map((m, i) => `[${i}]: from (${m.from.r},${m.from.c}) to (${m.to.r},${m.to.c})${m.captured ? ` capturing (${m.captured[0].r},${m.captured[0].c})` : ''}`).join('\n')}

Evaluate the board and choose the best move. Think ahead. Protect your pieces and try to capture opponent pieces or become a King.
Return a JSON object with a single property "moveIndex" containing the integer index of the move you choose.`;

          const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  moveIndex: { type: Type.INTEGER, description: "The index of the chosen move from the valid moves list." }
                },
                required: ["moveIndex"]
              }
            }
          });
          
          const jsonStr = response.text?.trim() || "{}";
          const data = JSON.parse(jsonStr);
          let idx = data.moveIndex;
          if (idx === undefined || idx < 0 || idx >= validMoves.length) idx = 0;
          
          setGeminiThoughts("Move decided!");
          setTimeout(() => {
            handleMove(validMoves[idx]);
            setIsGeminiThinking(false);
            setGeminiThoughts("");
          }, 500);
          
        } catch (e) {
          console.error("Gemini error:", e);
          const idx = Math.floor(Math.random() * validMoves.length);
          handleMove(validMoves[idx]);
          setIsGeminiThinking(false);
          setGeminiThoughts("");
        }
      };
      
      // Add a small delay before Gemini starts thinking to feel more natural
      setTimeout(playGemini, 500);
    }
  }, [turn, winner, board, validMoves, handleMove, isGeminiThinking]);

  const onSquareClick = (r: number, c: number) => {
    if (turn !== 1 || winner || isGeminiThinking) return;
    
    if (selectedPiece) {
      const move = validMoves.find(m => m.from.r === selectedPiece.r && m.from.c === selectedPiece.c && m.to.r === r && m.to.c === c);
      if (move) {
        handleMove(move);
        return;
      }
    }
    
    const piece = board[r][c];
    if (piece === 1 || piece === 3) {
      if (mustJumpPiece && (r !== mustJumpPiece.r || c !== mustJumpPiece.c)) return;
      
      const hasMoves = validMoves.some(m => m.from.r === r && m.from.c === c);
      if (hasMoves) {
        setSelectedPiece({ r, c });
      } else {
        setSelectedPiece(null);
      }
    } else {
      setSelectedPiece(null);
    }
  };

  const resetGame = () => {
    setBoard(INITIAL_BOARD);
    setTurn(1);
    setMustJumpPiece(null);
    setSelectedPiece(null);
    setWinner(null);
    setIsGeminiThinking(false);
    setGeminiThoughts("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="atmosphere"></div>
      
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 items-center">
        
        {/* Left Panel - Player 1 */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col items-center gap-4 self-center justify-self-center lg:justify-self-end w-64">
          <div className="w-20 h-20 rounded-full piece-red flex items-center justify-center">
            <User className="w-10 h-10 text-white opacity-80" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">You</h2>
            <p className="text-pink-400 font-mono text-sm uppercase tracking-widest mt-1">Neon Red</p>
          </div>
          <div className="h-12 flex items-center justify-center">
            {turn === 1 && !winner && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-200 text-sm font-medium flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
                Your Turn
              </motion.div>
            )}
          </div>
        </div>

        {/* Center - Board */}
        <div className="flex flex-col items-center gap-8">
          
          {/* Header */}
          <div className="text-center">
            <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-cyan-500">
              CYBER CHECKERS
            </h1>
            <p className="text-white/50 font-mono text-sm tracking-[0.2em] mt-2 uppercase">Powered by Gemini</p>
          </div>

          {/* Board Container */}
          <div className="glass-panel p-4 rounded-3xl relative">
            <div className="grid grid-cols-8 grid-rows-8 gap-1 p-1 bg-black/50 rounded-2xl border border-white/5">
              {board.map((row, r) => 
                row.map((piece, c) => {
                  const isDark = (r + c) % 2 === 1;
                  const isSelected = selectedPiece?.r === r && selectedPiece?.c === c;
                  const isValidMove = selectedPiece && validMoves.some(m => m.from.r === selectedPiece.r && m.from.c === selectedPiece.c && m.to.r === r && m.to.c === c);
                  
                  return (
                    <div 
                      key={`${r}-${c}`}
                      onClick={() => onSquareClick(r, c)}
                      className={`w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-lg relative flex items-center justify-center cursor-pointer transition-colors duration-300
                        ${isDark ? 'board-square-dark' : 'board-square-light'}
                        ${isSelected ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-black/50' : ''}
                        ${isValidMove ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black/50 bg-cyan-900/30' : ''}
                      `}
                    >
                      {isValidMove && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f0ff] animate-pulse"></div>
                        </div>
                      )}
                      
                      <AnimatePresence>
                        {piece !== 0 && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className={`w-[80%] h-[80%] rounded-full relative z-10
                              ${(piece === 1 || piece === 3) ? 'piece-red' : 'piece-blue'}
                            `}
                          >
                            {(piece === 3 || piece === 4) && (
                              <div className="piece-king-inner">
                                <Crown className="w-1/2 h-1/2 text-white/80" />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
            
            {winner && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl">
                <div className="glass-panel p-8 rounded-2xl text-center flex flex-col items-center gap-4">
                  <Crown className={`w-16 h-16 ${winner === 1 ? 'text-pink-500' : 'text-cyan-500'}`} />
                  <h2 className="text-4xl font-bold">
                    {winner === 1 ? 'You Win!' : 'Gemini Wins!'}
                  </h2>
                  <button 
                    onClick={resetGame}
                    className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 transition-colors rounded-full font-medium flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Play Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Player 2 (Gemini) */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col items-center gap-4 self-center justify-self-center lg:justify-self-start w-64">
          <div className="w-20 h-20 rounded-full piece-blue flex items-center justify-center relative">
            <Bot className="w-10 h-10 text-white opacity-80" />
            {isGeminiThinking && (
              <div className="absolute -inset-2 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
              Gemini <Sparkles className="w-5 h-5 text-cyan-400" />
            </h2>
            <p className="text-cyan-400 font-mono text-sm uppercase tracking-widest mt-1">Neon Blue</p>
          </div>
          
          <div className="h-12 flex items-center justify-center">
            {turn === 2 && !winner && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-200 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
              >
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                {geminiThoughts || "Thinking..."}
              </motion.div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
