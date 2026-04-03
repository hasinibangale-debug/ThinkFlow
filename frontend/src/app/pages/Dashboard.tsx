import { Link } from 'react-router';
import { Target, Smile, Gamepad2, Lightbulb, BarChart3, ArrowRight } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { habits, moodEntries, shouldShowGames, shouldShowSuggestions } = useData();
  const [typingMood, setTypingMood] = useState('Neutral');
  const [faceMood, setFaceMood] = useState('Neutral');
  const [finalMood, setFinalMood] = useState('Neutral');

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8000/emotion');
        if (!res.ok) {
          return;
        }

        const data = await res.json() as { typingMood?: string; faceMood?: string };
        const nextTyping = data.typingMood ?? 'Neutral';
        const nextFace = data.faceMood ?? 'Neutral';

        setTypingMood(nextTyping);
        setFaceMood(nextFace);

        if (nextTyping === 'Frustrated' || nextFace.toLowerCase() === 'sad') {
          setFinalMood('Frustrated 😓');
        } else {
          setFinalMood('Confident 🔥');
        }
      } catch {
        // Keep dashboard live even if bridge is down.
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      title: 'Habit Tracker',
      description: 'Build consistent routines and track your progress over time',
      icon: Target,
      path: '/habits',
      gradient: 'from-[#800020] to-[#b08968]',
      stats: `${habits.length} active habits`,
    },
    {
      title: 'Mood Tracker',
      description: 'Log your feelings and energy levels throughout your journey',
      icon: Smile,
      path: '/mood',
      gradient: 'from-[#DCAE96] to-[#b08968]',
      stats: `${moodEntries.length} entries logged`,
    },
    {
      title: 'Mindful Games',
      description: 'Take a break with fun games when you need a mental boost',
      icon: Gamepad2,
      path: '/games',
      gradient: 'from-[#e07a5f] to-[#f4a261]',
      stats: '3 games available',
      highlight: shouldShowGames(),
    },
    {
      title: 'Smart Suggestions',
      description: 'Get personalized motivational tips based on your progress',
      icon: Lightbulb,
      path: '/suggestions',
      gradient: 'from-[#f4a261] to-[#DCAE96]',
      stats: 'AI-powered insights',
      highlight: shouldShowSuggestions(),
    },
    {
      title: 'Analytics',
      description: 'Visualize your progress with detailed charts and summaries',
      icon: BarChart3,
      path: '/analytics',
      gradient: 'from-[#b08968] to-[#e07a5f]',
      stats: 'Performance overview',
    },
  ];

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Welcome back!
        </h1>
        <p className="text-muted-foreground">
          Your mental wellness journey continues today
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={card.path}
                className="block relative group"
              >
                <div className="h-full bg-card border border-border rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all">
                  {card.highlight && (
                    <div className="absolute top-4 right-4 w-3 h-3 bg-[#e63946] rounded-full animate-pulse" />
                  )}
                  
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {card.title}
                  </h3>

                  <p className="text-muted-foreground mb-4 text-sm">
                    {card.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {card.stats}
                    </span>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {[{ label: 'Typing Mood', value: typingMood }, { label: 'Face Mood', value: faceMood }, { label: 'Final Mood', value: finalMood }].map((entry) => (
          <div key={entry.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{entry.label}</div>
            <div className="text-lg font-semibold text-foreground">{entry.value}</div>
          </div>
        ))}
      </motion.div>

      {shouldShowGames() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-6 bg-gradient-to-r from-[#e07a5f] to-[#f4a261] rounded-2xl text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Need a break?</h3>
              <p className="text-white/80">
                We noticed you might be feeling low. Try some games to lift your spirits!
              </p>
            </div>
            <Link
              to="/games"
              className="px-6 py-3 bg-white text-[#e07a5f] font-semibold rounded-full hover:bg-white/90 transition-colors"
            >
              Play Now
            </Link>
          </div>
        </motion.div>
      )}

      {shouldShowSuggestions() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-6 bg-gradient-to-r from-[#f4a261] to-[#DCAE96] rounded-2xl text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Your progress needs attention</h3>
              <p className="text-white/80">
                Check out personalized suggestions to get back on track!
              </p>
            </div>
            <Link
              to="/suggestions"
              className="px-6 py-3 bg-white text-[#f4a261] font-semibold rounded-full hover:bg-white/90 transition-colors"
            >
              View Tips
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
