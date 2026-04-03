import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface GameStats {
  tictactoe: {
    wins: number;
    losses: number;
    draws: number;
    gamesPlayed: number;
  };
  riddles: {
    solved: number;
    total: number;
  };
  quiz: {
    correctAnswers: number;
    totalQuestions: number;
    perfectScores: number;
  };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

interface GamesContextType {
  stats: GameStats;
  level: number;
  xp: number;
  badges: Badge[];
  recordWin: (game: 'tictactoe') => void;
  recordLoss: (game: 'tictactoe') => void;
  recordDraw: (game: 'tictactoe') => void;
  recordRiddleSolved: () => void;
  recordQuizAnswer: (correct: boolean, perfectScore: boolean) => void;
  addXP: (amount: number) => void;
}

const GamesContext = createContext<GamesContextType | undefined>(undefined);

const INITIAL_BADGES: Badge[] = [
  { id: 'first-win', name: 'First Victory', description: 'Win your first Tic Tac Toe game', icon: '🏆', unlocked: false },
  { id: 'tictactoe-master', name: 'Tic Tac Toe Master', description: 'Win 10 Tic Tac Toe games', icon: '👑', unlocked: false },
  { id: 'riddle-solver', name: 'Riddle Solver', description: 'Solve 5 riddles', icon: '🧩', unlocked: false },
  { id: 'quiz-champion', name: 'Quiz Champion', description: 'Score a perfect quiz', icon: '⭐', unlocked: false },
  { id: 'dedicated-player', name: 'Dedicated Player', description: 'Play 25 total games', icon: '🎮', unlocked: false },
  { id: 'level-10', name: 'Rising Star', description: 'Reach level 10', icon: '🌟', unlocked: false },
  { id: 'unbeatable', name: 'Unbeatable', description: 'Win 5 games in a row', icon: '🔥', unlocked: false },
];

export function GamesProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('thinkflow-game-stats');
    return saved ? JSON.parse(saved) : {
      tictactoe: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 },
      riddles: { solved: 0, total: 0 },
      quiz: { correctAnswers: 0, totalQuestions: 0, perfectScores: 0 },
    };
  });

  const [xp, setXP] = useState(() => {
    const saved = localStorage.getItem('thinkflow-xp');
    return saved ? parseInt(saved) : 0;
  });

  const [badges, setBadges] = useState<Badge[]>(() => {
    const saved = localStorage.getItem('thinkflow-badges');
    return saved ? JSON.parse(saved) : INITIAL_BADGES;
  });

  const level = Math.floor(xp / 100) + 1;

  useEffect(() => {
    localStorage.setItem('thinkflow-game-stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('thinkflow-xp', xp.toString());
  }, [xp]);

  useEffect(() => {
    localStorage.setItem('thinkflow-badges', JSON.stringify(badges));
  }, [badges]);

  const unlockBadge = (badgeId: string) => {
    setBadges(prev => prev.map(badge => 
      badge.id === badgeId && !badge.unlocked
        ? { ...badge, unlocked: true, unlockedAt: new Date().toISOString() }
        : badge
    ));
  };

  const checkBadges = (newStats: GameStats) => {
    if (newStats.tictactoe.wins >= 1) unlockBadge('first-win');
    if (newStats.tictactoe.wins >= 10) unlockBadge('tictactoe-master');
    if (newStats.riddles.solved >= 5) unlockBadge('riddle-solver');
    if (newStats.quiz.perfectScores >= 1) unlockBadge('quiz-champion');
    
    const totalGames = newStats.tictactoe.gamesPlayed + newStats.riddles.solved + (newStats.quiz.totalQuestions / 4);
    if (totalGames >= 25) unlockBadge('dedicated-player');
    
    if (level >= 10) unlockBadge('level-10');
  };

  const addXP = (amount: number) => {
    setXP(prev => prev + amount);
  };

  const recordWin = (game: 'tictactoe') => {
    const newStats = {
      ...stats,
      [game]: {
        ...stats[game],
        wins: stats[game].wins + 1,
        gamesPlayed: stats[game].gamesPlayed + 1,
      },
    };
    setStats(newStats);
    addXP(30);
    checkBadges(newStats);
  };

  const recordLoss = (game: 'tictactoe') => {
    const newStats = {
      ...stats,
      [game]: {
        ...stats[game],
        losses: stats[game].losses + 1,
        gamesPlayed: stats[game].gamesPlayed + 1,
      },
    };
    setStats(newStats);
    addXP(10);
    checkBadges(newStats);
  };

  const recordDraw = (game: 'tictactoe') => {
    const newStats = {
      ...stats,
      [game]: {
        ...stats[game],
        draws: stats[game].draws + 1,
        gamesPlayed: stats[game].gamesPlayed + 1,
      },
    };
    setStats(newStats);
    addXP(15);
    checkBadges(newStats);
  };

  const recordRiddleSolved = () => {
    const newStats = {
      ...stats,
      riddles: {
        ...stats.riddles,
        solved: stats.riddles.solved + 1,
        total: stats.riddles.total + 1,
      },
    };
    setStats(newStats);
    addXP(20);
    checkBadges(newStats);
  };

  const recordQuizAnswer = (correct: boolean, perfectScore: boolean) => {
    const newStats = {
      ...stats,
      quiz: {
        ...stats.quiz,
        correctAnswers: correct ? stats.quiz.correctAnswers + 1 : stats.quiz.correctAnswers,
        totalQuestions: stats.quiz.totalQuestions + 1,
        perfectScores: perfectScore ? stats.quiz.perfectScores + 1 : stats.quiz.perfectScores,
      },
    };
    setStats(newStats);
    addXP(correct ? 15 : 5);
    checkBadges(newStats);
  };

  return (
    <GamesContext.Provider value={{
      stats,
      level,
      xp,
      badges,
      recordWin,
      recordLoss,
      recordDraw,
      recordRiddleSolved,
      recordQuizAnswer,
      addXP,
    }}>
      {children}
    </GamesContext.Provider>
  );
}

export function useGames() {
  const context = useContext(GamesContext);
  if (!context) {
    throw new Error('useGames must be used within GamesProvider');
  }
  return context;
}
