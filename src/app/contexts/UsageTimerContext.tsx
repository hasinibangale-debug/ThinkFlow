import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coffee, Eye, Sparkles } from 'lucide-react';

interface UsageTimerContextType {
  sessionTime: number;
  resetTimer: () => void;
}

const UsageTimerContext = createContext<UsageTimerContextType | undefined>(undefined);

export function UsageTimerProvider({ children }: { children: ReactNode }) {
  const [sessionTime, setSessionTime] = useState(0);
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [lastReminderTime, setLastReminderTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Show break reminder every 15 minutes (900 seconds)
    if (sessionTime > 0 && sessionTime % 900 === 0 && sessionTime !== lastReminderTime) {
      setShowBreakReminder(true);
      setLastReminderTime(sessionTime);
    }
  }, [sessionTime, lastReminderTime]);

  const resetTimer = () => {
    setSessionTime(0);
    setLastReminderTime(0);
  };

  const tips = [
    { icon: Eye, text: "Look away from the screen and focus on something 20 feet away for 20 seconds." },
    { icon: Coffee, text: "Stand up, stretch your arms and legs, and take a short walk." },
    { icon: Sparkles, text: "Roll your shoulders, move your head gently, and take deep breaths." },
  ];

  const currentTip = tips[Math.floor(sessionTime / 900) % tips.length];
  const TipIcon = currentTip.icon;

  return (
    <UsageTimerContext.Provider value={{ sessionTime, resetTimer }}>
      {children}
      
      <AnimatePresence>
        {showBreakReminder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowBreakReminder(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border-2 border-primary rounded-2xl shadow-2xl p-8 max-w-md w-full"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#800020] to-[#DCAE96] flex items-center justify-center">
                  <TipIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Time for a Break! 🌟
                </h3>
                <p className="text-muted-foreground">
                  You've been using ThinkFlow for {Math.floor(sessionTime / 60)} minutes
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 mb-6">
                <p className="text-foreground text-center leading-relaxed">
                  {currentTip.text}
                </p>
              </div>

              <button
                onClick={() => setShowBreakReminder(false)}
                className="w-full py-3 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Got it, thanks! ✨
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </UsageTimerContext.Provider>
  );
}

export function useUsageTimer() {
  const context = useContext(UsageTimerContext);
  if (!context) {
    throw new Error('useUsageTimer must be used within UsageTimerProvider');
  }
  return context;
}
