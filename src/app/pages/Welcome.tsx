import { useNavigate } from 'react-router';
import { Sparkles, Brain, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect } from 'react';

export default function Welcome() {
  const navigate = useNavigate();

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('thinkflow-theme') || 'light';
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fdf8f5] via-[#f5f5dc] to-[#DCAE96] dark:from-[#1a1110] dark:via-[#2b1f1e] dark:to-[#3d2f2a] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#800020] to-[#DCAE96] mb-8 shadow-2xl"
        >
          <Brain className="w-12 h-12 text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-6xl font-bold mb-4 bg-gradient-to-r from-[#800020] via-[#b08968] to-[#DCAE96] bg-clip-text text-transparent"
        >
          Welcome to ThinkFlow
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xl text-muted-foreground mb-12"
        >
          Your personal companion for habits, mood tracking, and mental wellness
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap gap-6 justify-center mb-12"
        >
          <div className="flex items-center gap-2 text-foreground/80">
            <Sparkles className="w-5 h-5 text-[#800020]" />
            <span>Track Your Habits</span>
          </div>
          <div className="flex items-center gap-2 text-foreground/80">
            <Brain className="w-5 h-5 text-[#DCAE96]" />
            <span>Monitor Your Mood</span>
          </div>
          <div className="flex items-center gap-2 text-foreground/80">
            <TrendingUp className="w-5 h-5 text-[#b08968]" />
            <span>Grow Daily</span>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/dashboard')}
          className="px-12 py-4 text-lg font-semibold text-white bg-gradient-to-r from-[#800020] to-[#DCAE96] rounded-full shadow-xl hover:shadow-2xl transition-shadow"
        >
          Get Started
        </motion.button>
      </motion.div>
    </div>
  );
}