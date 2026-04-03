import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Habit {
  id: string;
  name: string;
  description: string;
  color: string;
  completedDates: string[]; // ISO date strings
  createdAt: string;
}

export interface MoodEntry {
  id: string;
  date: string;
  mood: 'great' | 'good' | 'okay' | 'low' | 'tired';
  energy: number; // 1-10
  notes: string;
}

interface DataContextType {
  habits: Habit[];
  moodEntries: MoodEntry[];
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'completedDates'>) => void;
  toggleHabitCompletion: (habitId: string, date: string) => void;
  deleteHabit: (habitId: string) => void;
  addMoodEntry: (entry: Omit<MoodEntry, 'id'>) => void;
  getRecentMood: () => MoodEntry | null;
  shouldShowGames: () => boolean;
  shouldShowSuggestions: () => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem('thinkflow-habits');
    return saved ? JSON.parse(saved) : [];
  });

  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>(() => {
    const saved = localStorage.getItem('thinkflow-moods');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('thinkflow-habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('thinkflow-moods', JSON.stringify(moodEntries));
  }, [moodEntries]);

  const addHabit = (habit: Omit<Habit, 'id' | 'createdAt' | 'completedDates'>) => {
    const newHabit: Habit = {
      ...habit,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      completedDates: [],
    };
    setHabits(prev => [...prev, newHabit]);
  };

  const toggleHabitCompletion = (habitId: string, date: string) => {
    setHabits(prev => prev.map(habit => {
      if (habit.id === habitId) {
        const dateExists = habit.completedDates.includes(date);
        return {
          ...habit,
          completedDates: dateExists
            ? habit.completedDates.filter(d => d !== date)
            : [...habit.completedDates, date],
        };
      }
      return habit;
    }));
  };

  const deleteHabit = (habitId: string) => {
    setHabits(prev => prev.filter(h => h.id !== habitId));
  };

  const addMoodEntry = (entry: Omit<MoodEntry, 'id'>) => {
    const newEntry: MoodEntry = {
      ...entry,
      id: Date.now().toString(),
    };
    setMoodEntries(prev => [...prev, newEntry]);
  };

  const getRecentMood = () => {
    if (moodEntries.length === 0) return null;
    return moodEntries[moodEntries.length - 1];
  };

  const shouldShowGames = () => {
    const recentMood = getRecentMood();
    return recentMood?.mood === 'low' || recentMood?.mood === 'tired' || (recentMood?.energy ?? 10) < 4;
  };

  const shouldShowSuggestions = () => {
    // Check if there's a declining trend in habits or mood
    if (habits.length === 0) return false;
    
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });

    const completionRates = last7Days.map(date => {
      const completed = habits.filter(h => h.completedDates.includes(date)).length;
      return habits.length > 0 ? completed / habits.length : 0;
    });

    // Check for declining trend
    const recentAvg = completionRates.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const olderAvg = completionRates.slice(3, 6).reduce((a, b) => a + b, 0) / 3;

    return recentAvg < olderAvg * 0.7; // 30% decline
  };

  return (
    <DataContext.Provider value={{
      habits,
      moodEntries,
      addHabit,
      toggleHabitCompletion,
      deleteHabit,
      addMoodEntry,
      getRecentMood,
      shouldShowGames,
      shouldShowSuggestions,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}
