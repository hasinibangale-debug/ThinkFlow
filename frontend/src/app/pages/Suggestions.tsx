import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, TrendingUp, Heart, Coffee, Zap, Sun, Clock, Brain, Smile } from 'lucide-react';
import { Link } from 'react-router';
import { useData } from '../contexts/DataContext';
import { motion, AnimatePresence } from 'motion/react';

interface Suggestion {
  id: string;
  icon: typeof Sparkles;
  title: string;
  description: string;
  color: string;
  tips: string[];
}

const RELAXATION_TIPS = [
  { icon: '🌊', text: 'Take 5 deep breaths. Inhale for 4, hold for 4, exhale for 4.' },
  { icon: '🎵', text: 'Listen to your favorite calming music for a few minutes.' },
  { icon: '🧘', text: 'Do a quick 2-minute stretching session at your desk.' },
  { icon: '💧', text: 'Drink a glass of water and take a moment to hydrate.' },
  { icon: '👀', text: 'Look at something 20 feet away for 20 seconds to rest your eyes.' },
  { icon: '🌱', text: 'Think of one thing you\'re grateful for right now.' },
  { icon: '☕', text: 'Step away from your screen and enjoy a warm beverage.' },
  { icon: '🪟', text: 'Look out the window and observe nature for a moment.' },
];

export default function Suggestions() {
  const { habits, moodEntries, shouldShowSuggestions } = useData();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [peakHours, setPeakHours] = useState<{ morning: number, afternoon: number, evening: number }>({ morning: 0, afternoon: 0, evening: 0 });
  const [showRelaxationTip, setShowRelaxationTip] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    generateSuggestions();
    calculatePeakHours();
    
    // Show relaxation tip every 30 seconds for demo (in production, could be longer)
    const tipInterval = setInterval(() => {
      setShowRelaxationTip(true);
      setCurrentTip(Math.floor(Math.random() * RELAXATION_TIPS.length));
      setTimeout(() => setShowRelaxationTip(false), 8000);
    }, 120000); // Every 2 minutes

    return () => clearInterval(tipInterval);
  }, [habits, moodEntries]);

  const calculatePeakHours = () => {
    if (habits.length === 0) {
      setPeakHours({ morning: 70, afternoon: 60, evening: 50 });
      return;
    }

    // Analyze when habits are most completed based on created times
    let morningScore = 0;
    let afternoonScore = 0;
    let eveningScore = 0;

    habits.forEach(habit => {
      habit.completedDates.forEach(date => {
        const hour = new Date(date).getHours();
        if (hour >= 6 && hour < 12) morningScore++;
        else if (hour >= 12 && hour < 18) afternoonScore++;
        else eveningScore++;
      });
    });

    const total = morningScore + afternoonScore + eveningScore || 1;
    setPeakHours({
      morning: Math.round((morningScore / total) * 100),
      afternoon: Math.round((afternoonScore / total) * 100),
      evening: Math.round((eveningScore / total) * 100),
    });
  };

  const generateSuggestions = () => {
    const newSuggestions: Suggestion[] = [];

    // Calculate habit completion rate
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });

    const completionRates = last7Days.map(date => {
      const completed = habits.filter(h => h.completedDates.includes(date)).length;
      return habits.length > 0 ? (completed / habits.length) * 100 : 0;
    });

    const avgCompletion = completionRates.reduce((a, b) => a + b, 0) / completionRates.length;

    // Check recent moods
    const recentMoods = moodEntries.slice(-7);
    const lowMoodCount = recentMoods.filter(m => m.mood === 'low' || m.mood === 'tired').length;
    const avgEnergy = recentMoods.length > 0
      ? recentMoods.reduce((sum, m) => sum + m.energy, 0) / recentMoods.length
      : 5;

    // Analyze trends for dynamic suggestions
    const recentAvg = completionRates.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const olderAvg = completionRates.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
    const isImproving = recentAvg > olderAvg;

    // Generate personalized suggestions based on data
    if (isImproving && avgCompletion >= 60) {
      newSuggestions.push({
        id: 'improving',
        icon: TrendingUp,
        title: 'You\'re On Fire! 🔥',
        description: 'Your habit completion is trending upward!',
        color: 'from-green-500 to-emerald-500',
        tips: [
          'You\'ve built amazing momentum - keep this energy going!',
          'Consider challenging yourself with a new habit',
          'Share your success story to inspire others',
          'Reward yourself for this milestone achievement',
          'Document what\'s working so you can replicate it',
        ],
      });
    } else if (avgCompletion < 50 && !isImproving) {
      newSuggestions.push({
        id: 'boost',
        icon: TrendingUp,
        title: 'Let\'s Rebuild Momentum',
        description: 'Time to get back on track with your habits',
        color: 'from-orange-500 to-red-500',
        tips: [
          'Break habits into smaller, more manageable pieces',
          'Focus on your "why" - remember your initial motivation',
          'Start with just ONE habit you can commit to today',
          'Set up environment cues to remind you (post-its, alarms)',
          'Find an accountability partner to check in with daily',
        ],
      });
    }

    if (lowMoodCount >= 3 || avgEnergy < 5) {
      newSuggestions.push({
        id: 'selfcare',
        icon: Heart,
        title: 'Prioritize Your Well-being',
        description: 'Your mood patterns suggest you need more self-care',
        color: 'from-pink-500 to-purple-500',
        tips: [
          'Schedule "me time" - block it in your calendar like any important meeting',
          'Try the 5-4-3-2-1 grounding technique when feeling overwhelmed',
          'Reach out to someone you trust - connection heals',
          'Practice self-compassion: talk to yourself like a good friend would',
          'Consider professional support if feelings persist',
        ],
      });
    }

    if (avgEnergy < 6) {
      newSuggestions.push({
        id: 'energy',
        icon: Zap,
        title: 'Boost Your Energy Levels',
        description: 'Let\'s work on increasing your daily vitality',
        color: 'from-yellow-500 to-orange-500',
        tips: [
          'Prioritize 7-9 hours of quality sleep - it\'s non-negotiable',
          'Move your body: even 10 minutes of walking helps',
          'Eat protein with every meal to stabilize blood sugar',
          'Limit caffeine after 2 PM for better sleep quality',
          'Take power naps (10-20 min) when energy dips',
        ],
      });
    }

    if (avgCompletion >= 70) {
      newSuggestions.push({
        id: 'excellence',
        icon: Sparkles,
        title: 'Excellence in Action',
        description: 'Your consistency is truly inspiring!',
        color: 'from-purple-500 to-pink-500',
        tips: [
          'You\'re in the top tier! Consider mentoring someone else',
          'Reflect and journal about your transformation journey',
          'Level up: add a habit that scares you a little',
          'Take progress photos or notes to see how far you\'ve come',
          'Share your routine on social media to inspire others',
        ],
      });
    }

    // Time-based suggestions
    const currentHour = new Date().getHours();
    if (currentHour >= 6 && currentHour < 12) {
      newSuggestions.push({
        id: 'morning',
        icon: Sun,
        title: 'Morning Success Strategy',
        description: 'Start your day with intention and energy',
        color: 'from-yellow-400 to-orange-400',
        tips: [
          'Hydrate first: drink water before coffee',
          'Get sunlight exposure within 30 minutes of waking',
          'Review your top 3 priorities for the day',
          'Do your hardest task when energy is highest',
          'Avoid checking email/social media for the first hour',
        ],
      });
    } else if (currentHour >= 12 && currentHour < 18) {
      newSuggestions.push({
        id: 'afternoon',
        icon: Coffee,
        title: 'Afternoon Productivity Tips',
        description: 'Beat the afternoon slump and stay focused',
        color: 'from-amber-500 to-orange-500',
        tips: [
          'Take a 5-minute walk to re-energize',
          'Have a healthy snack with protein and healthy fats',
          'Use the Pomodoro technique: 25 min work, 5 min break',
          'Review morning progress and adjust evening plans',
          'Stay hydrated - aim for another glass of water',
        ],
      });
    } else {
      newSuggestions.push({
        id: 'evening',
        icon: Brain,
        title: 'Evening Wind-Down Routine',
        description: 'Prepare for restful sleep and tomorrow\'s success',
        color: 'from-indigo-500 to-purple-500',
        tips: [
          'Complete a brain dump: write down tomorrow\'s tasks',
          'Dim lights 2 hours before bed to promote melatonin',
          'Reflect on 3 wins from today, however small',
          'Avoid screens 1 hour before sleep',
          'Prepare tomorrow\'s clothes and meals tonight',
        ],
      });
    }

    // Always include general wellness
    newSuggestions.push({
      id: 'wellness',
      icon: Smile,
      title: 'Universal Wellness Wisdom',
      description: 'Timeless tips for mental and physical health',
      color: 'from-blue-500 to-cyan-500',
      tips: [
        'Practice gratitude daily - write 3 specific things you appreciate',
        'Connect with nature, even if just looking at plants',
        'Limit social media to 30 minutes per day',
        'Cultivate one meaningful relationship each week',
        'Remember: rest is productive, not lazy',
      ],
    });

    setSuggestions(newSuggestions);
  };

  const bestTimeToWork = Object.entries(peakHours).reduce((a, b) => a[1] > b[1] ? a : b)[0];

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Smart Suggestions
            </h1>
            <p className="text-muted-foreground">
              Personalized tips that evolve with your progress
            </p>
          </div>
        </div>

        {/* Floating Relaxation Tip */}
        <AnimatePresence>
          {showRelaxationTip && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-8 right-8 z-40 max-w-sm"
            >
              <div className="bg-gradient-to-br from-[#800020] to-[#DCAE96] text-white p-6 rounded-2xl shadow-2xl border-2 border-white/20">
                <div className="flex items-start gap-3">
                  <span className="text-4xl">{RELAXATION_TIPS[currentTip].icon}</span>
                  <div className="flex-1">
                    <h4 className="font-bold mb-1">Time to Relax 💆</h4>
                    <p className="text-sm text-white/90">{RELAXATION_TIPS[currentTip].text}</p>
                  </div>
                  <button
                    onClick={() => setShowRelaxationTip(false)}
                    className="text-white/70 hover:text-white text-xl"
                  >
                    ×
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Peak Productivity Hours */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary/20 rounded-2xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Your Peak Productivity Hours</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Based on your habit completion patterns, you're most productive in the <strong>{bestTimeToWork}</strong>.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(peakHours).map(([time, score]) => (
              <div key={time} className="text-center">
                <div className="mb-2">
                  <div className="text-2xl font-bold text-primary">{score}%</div>
                  <div className="text-sm text-muted-foreground capitalize">{time}</div>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-[#800020] to-[#DCAE96] rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {shouldShowSuggestions() && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl text-white shadow-xl"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">We're Here to Help!</h3>
                <p className="text-yellow-100">
                  We've analyzed your patterns and created dynamic suggestions tailored to your current progress.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-6">
          {suggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden"
              >
                <div className={`p-6 bg-gradient-to-r ${suggestion.color}`}>
                  <div className="flex items-center gap-4 text-white">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{suggestion.title}</h3>
                      <p className="text-white/90">{suggestion.description}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="font-semibold text-foreground mb-4">
                    Action steps:
                  </h4>
                  <ul className="space-y-3">
                    {suggestion.tips.map((tip, tipIndex) => (
                      <motion.li
                        key={tipIndex}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (index * 0.1) + (tipIndex * 0.05) }}
                        className="flex items-start gap-3 text-muted-foreground"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#800020] to-[#DCAE96] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">{tipIndex + 1}</span>
                        </div>
                        <span>{tip}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: suggestions.length * 0.1 }}
          className="mt-8 p-8 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl text-center border-2 border-primary/20"
        >
          <h3 className="text-2xl font-bold text-foreground mb-3">
            Remember 💭
          </h3>
          <p className="text-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Progress isn't linear. You'll have great days and challenging days - both are part of growth.
            What matters is consistency over perfection. You're doing better than you think! Keep going! 🌟
          </p>
        </motion.div>
      </div>
    </div>
  );
}
