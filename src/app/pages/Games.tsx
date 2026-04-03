import { useState } from 'react';
import { ArrowLeft, Gamepad2, Brain, Sparkles, Trophy, Award, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useGames } from '../contexts/GamesContext';
import confetti from 'canvas-confetti';

export default function Games() {
  const [activeGame, setActiveGame] = useState<'tictactoe' | 'riddles' | 'quiz' | null>(null);
  const { level, xp, badges } = useGames();

  const xpToNextLevel = (level * 100) - xp;
  const xpProgress = (xp % 100) / 100 * 100;
  const unlockedBadges = badges.filter(b => b.unlocked);

  if (activeGame === 'tictactoe') {
    return <TicTacToe onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === 'riddles') {
    return <Riddles onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === 'quiz') {
    return <Quiz onBack={() => setActiveGame(null)} />;
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-muted-foreground" />
          </Link>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Mindful Games
            </h1>
            <p className="text-muted-foreground">
              Take a break and recharge your mind
            </p>
          </div>
        </div>

        {/* Level & XP Progress */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary/20 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#800020] to-[#DCAE96] flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground">Level {level}</h3>
                <p className="text-sm text-muted-foreground">{xpToNextLevel} XP to next level</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{unlockedBadges.length}/{badges.length}</div>
              <p className="text-sm text-muted-foreground">Badges Earned</p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-[#800020] to-[#DCAE96] rounded-full flex items-center justify-end pr-2"
            >
              {xpProgress > 15 && (
                <span className="text-xs font-bold text-white">{Math.floor(xpProgress)}%</span>
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* Badges Display */}
        {unlockedBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8"
          >
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Your Badges
            </h2>
            <div className="flex flex-wrap gap-3">
              {badges.map((badge, idx) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    badge.unlocked
                      ? 'bg-gradient-to-r from-[#800020]/20 to-[#DCAE96]/20 border-2 border-primary/30'
                      : 'bg-muted/50 opacity-50 border border-border'
                  }`}
                  title={badge.description}
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <span className="text-sm font-medium text-foreground">{badge.name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Game Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.05, rotate: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveGame('tictactoe')}
            className="p-8 bg-card border border-border rounded-2xl shadow-lg hover:shadow-2xl transition-all text-left group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                Tic Tac Toe
              </h3>
              <p className="text-muted-foreground text-sm">
                Classic game to sharpen your strategic thinking
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                <Zap className="w-4 h-4" />
                +30 XP per win
              </div>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.05, rotate: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveGame('riddles')}
            className="p-8 bg-card border border-border rounded-2xl shadow-lg hover:shadow-2xl transition-all text-left group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#800020]/10 to-[#DCAE96]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#800020] to-[#DCAE96] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                Brain Riddles
              </h3>
              <p className="text-muted-foreground text-sm">
                Funny riddles to lift your spirits and exercise your mind
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                <Zap className="w-4 h-4" />
                +20 XP per riddle
              </div>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.05, rotate: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveGame('quiz')}
            className="p-8 bg-card border border-border rounded-2xl shadow-lg hover:shadow-2xl transition-all text-left group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                Fun Quiz
              </h3>
              <p className="text-muted-foreground text-sm">
                Quick trivia questions to boost your mood
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                <Zap className="w-4 h-4" />
                +15 XP per question
              </div>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function TicTacToe({ onBack }: { onBack: () => void }) {
  const { recordWin, recordLoss, recordDraw, badges } = useGames();
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const calculateWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const handleClick = (i: number) => {
    if (board[i] || winner) return;
    const newBoard = [...board];
    newBoard[i] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
    const gameWinner = calculateWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      if (gameWinner === 'X') {
        recordWin('tictactoe');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#800020', '#DCAE96', '#b08968']
        });
        // Check if first win badge was just unlocked
        const firstWinBadge = badges.find(b => b.id === 'first-win' && !b.unlocked);
        if (firstWinBadge) {
          setTimeout(() => {
            confetti({
              particleCount: 150,
              spread: 100,
              origin: { y: 0.5 },
            });
          }, 500);
        }
      } else {
        recordLoss('tictactoe');
      }
    } else if (newBoard.every(cell => cell !== null)) {
      recordDraw('tictactoe');
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinner(null);
  };

  const isBoardFull = board.every(cell => cell !== null);

  return (
    <div className="p-8">
      <div className="max-w-md mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </button>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-xl"
        >
          <h2 className="text-3xl font-bold text-center text-foreground mb-6">
            Tic Tac Toe
          </h2>

          <div className="mb-6 text-center">
            <AnimatePresence mode="wait">
              {winner ? (
                <motion.div
                  key="winner"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-2xl font-bold text-green-500"
                >
                  {winner === 'X' ? '🎉 You win! +30 XP' : '💪 Player O wins!'}
                </motion.div>
              ) : isBoardFull ? (
                <motion.div
                  key="draw"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-2xl font-bold text-yellow-500"
                >
                  It's a draw! +15 XP
                </motion.div>
              ) : (
                <motion.div
                  key="turn"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl text-foreground"
                >
                  Player {isXNext ? 'X' : 'O'}'s turn
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {board.map((cell, i) => (
              <motion.button
                key={i}
                onClick={() => handleClick(i)}
                whileHover={{ scale: cell || winner ? 1 : 1.05 }}
                whileTap={{ scale: cell || winner ? 1 : 0.95 }}
                className={`aspect-square bg-muted rounded-xl text-4xl font-bold hover:bg-muted/80 transition-colors disabled:cursor-not-allowed ${
                  cell ? 'ring-2 ring-primary/30' : ''
                }`}
                disabled={!!cell || !!winner}
              >
                <motion.span
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: cell ? 1 : 0, rotate: cell ? 0 : -180 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className={cell === 'X' ? 'text-blue-500' : 'text-pink-500'}
                >
                  {cell}
                </motion.span>
              </motion.button>
            ))}
          </div>

          <button
            onClick={resetGame}
            className="w-full py-3 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
          >
            New Game
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function Riddles({ onBack }: { onBack: () => void }) {
  const { recordRiddleSolved } = useGames();
  const riddles = [
    {
      question: "What has keys but no locks, space but no room, and you can enter but can't go inside?",
      answer: "A keyboard",
    },
    {
      question: "I'm tall when I'm young, and I'm short when I'm old. What am I?",
      answer: "A candle",
    },
    {
      question: "What has a face and two hands but no arms or legs?",
      answer: "A clock",
    },
    {
      question: "What gets wetter the more it dries?",
      answer: "A towel",
    },
    {
      question: "What can travel around the world while staying in a corner?",
      answer: "A stamp",
    },
    {
      question: "What has many teeth but cannot bite?",
      answer: "A comb",
    },
    {
      question: "What goes up but never comes down?",
      answer: "Your age",
    },
    {
      question: "The more you take, the more you leave behind. What am I?",
      answer: "Footsteps",
    },
  ];

  const [currentRiddle, setCurrentRiddle] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const nextRiddle = () => {
    if (!showAnswer) {
      recordRiddleSolved();
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#800020', '#DCAE96']
      });
    }
    setCurrentRiddle((prev) => (prev + 1) % riddles.length);
    setShowAnswer(false);
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-xl"
        >
          <h2 className="text-3xl font-bold text-center text-foreground mb-6">
            Brain Riddles
          </h2>

          <div className="mb-6">
            <div className="text-sm text-muted-foreground mb-4 text-center">
              Riddle {currentRiddle + 1} of {riddles.length}
            </div>

            <motion.div
              key={currentRiddle}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br from-primary/10 to-secondary/10 p-8 rounded-xl mb-6"
            >
              <p className="text-xl text-foreground text-center leading-relaxed">
                {riddles[currentRiddle].question}
              </p>
            </motion.div>

            <AnimatePresence mode="wait">
              {showAnswer ? (
                <motion.div
                  key="answer"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border-2 border-green-500/30"
                >
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="text-4xl mb-2"
                    >
                      💡
                    </motion.div>
                    <div className="text-sm text-green-600 dark:text-green-400 font-semibold mb-2">
                      Answer (+20 XP)
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {riddles[currentRiddle].answer}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="show-answer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAnswer(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
                >
                  Show Answer
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {showAnswer && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={nextRiddle}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-muted text-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors"
            >
              Next Riddle
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function Quiz({ onBack }: { onBack: () => void }) {
  const { recordQuizAnswer } = useGames();
  const quizQuestions = [
    {
      question: "What's the best color in the rainbow?",
      options: ["All of them! 🌈", "The one I like 💜", "Sky blue ☁️", "Sunshine yellow ☀️"],
      correctAnswer: 0,
    },
    {
      question: "How many hours of sleep is 'just right'?",
      options: ["5 hours ⏰", "7-9 hours 😴", "12+ hours 🛌", "Sleep is for the weak!"],
      correctAnswer: 1,
    },
    {
      question: "What's the secret to happiness?",
      options: ["Pizza 🍕", "Puppies 🐶", "Good friends 💕", "All of the above!"],
      correctAnswer: 3,
    },
    {
      question: "Best way to start the day?",
      options: ["Coffee ☕", "Exercise 🏃", "Meditation 🧘", "Whatever makes you happy!"],
      correctAnswer: 3,
    },
  ];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    const isCorrect = answerIndex === quizQuestions[currentQuestion].correctAnswer;
    if (isCorrect) {
      setScore(score + 1);
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#800020', '#DCAE96']
      });
    }
  };

  const nextQuestion = () => {
    const isCorrect = selectedAnswer === quizQuestions[currentQuestion].correctAnswer;
    const isPerfect = currentQuestion === quizQuestions.length - 1 && score + (isCorrect ? 1 : 0) === quizQuestions.length;
    recordQuizAnswer(isCorrect, false);
    
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      if (isPerfect) {
        recordQuizAnswer(false, true);
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 },
        });
      }
      setShowResult(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setScore(0);
    setShowResult(false);
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-xl"
        >
          <h2 className="text-3xl font-bold text-center text-foreground mb-6">
            Fun Quiz
          </h2>

          {!showResult ? (
            <>
              <div className="mb-6">
                <div className="text-sm text-muted-foreground mb-4 text-center">
                  Question {currentQuestion + 1} of {quizQuestions.length}
                </div>

                <motion.div
                  key={currentQuestion}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gradient-to-br from-primary/10 to-secondary/10 p-6 rounded-xl mb-6"
                >
                  <p className="text-xl text-foreground text-center">
                    {quizQuestions[currentQuestion].question}
                  </p>
                </motion.div>

                <div className="space-y-3">
                  {quizQuestions[currentQuestion].options.map((option, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: selectedAnswer === null ? 1.02 : 1 }}
                      whileTap={{ scale: selectedAnswer === null ? 0.98 : 1 }}
                      onClick={() => handleAnswer(index)}
                      disabled={selectedAnswer !== null}
                      className={`w-full p-4 rounded-lg text-left font-medium transition-all ${
                        selectedAnswer === null
                          ? 'bg-muted hover:bg-muted/80'
                          : selectedAnswer === index
                          ? index === quizQuestions[currentQuestion].correctAnswer
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                          : index === quizQuestions[currentQuestion].correctAnswer
                          ? 'bg-green-500 text-white'
                          : 'bg-muted opacity-50'
                      }`}
                    >
                      {option}
                    </motion.button>
                  ))}
                </div>
              </div>

              {selectedAnswer !== null && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={nextQuestion}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
                >
                  {currentQuestion < quizQuestions.length - 1 ? 'Next Question' : 'See Results'}
                </motion.button>
              )}
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="text-6xl mb-4"
              >
                {score === quizQuestions.length ? '🎉' : score >= quizQuestions.length / 2 ? '😊' : '🌟'}
              </motion.div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Quiz Complete!
              </h3>
              <p className="text-xl text-muted-foreground mb-6">
                You scored {score} out of {quizQuestions.length}
              </p>
              <p className="text-foreground mb-6">
                {score === quizQuestions.length
                  ? "Perfect score! You're amazing! 🌟 Badge Unlocked!"
                  : score >= quizQuestions.length / 2
                  ? "Great job! Keep it up! 💪"
                  : "Good effort! Every day is a chance to grow! 🌱"}
              </p>
              <button
                onClick={resetQuiz}
                className="px-8 py-3 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
              >
                Play Again
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
