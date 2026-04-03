import { useState } from 'react';
import { Plus, Trash2, Check, CheckCircle2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

export default function HabitTracker() {
  const { habits, addHabit, toggleHabitCompletion, deleteHabit } = useData();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      addHabit({ name, description, color: 'from-[#800020] to-[#DCAE96]' });
      setName('');
      setDescription('');
      setShowForm(false);
      // Celebrate creating a new habit
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#800020', '#DCAE96', '#b08968']
      });
    }
  };

  const handleToggleCompletion = (habitId: string, date: string, isCompleted: boolean) => {
    toggleHabitCompletion(habitId, date);
    // Celebrate completing a habit
    if (!isCompleted) {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#800020', '#DCAE96']
      });
    }
  };

  // Get last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      date: d.toISOString().split('T')[0],
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
    };
  }).reverse();

  // Calculate today's completion
  const today = new Date().toISOString().split('T')[0];
  const todayCompleted = habits.filter(habit => habit.completedDates.includes(today)).length;
  const totalHabits = habits.length;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Habit Tracker
            </h1>
            <p className="text-muted-foreground">
              Build consistency one day at a time
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-full hover:shadow-lg transition-shadow"
          >
            <Plus className="w-5 h-5" />
            New Habit
          </button>
        </div>

        {/* Daily Completion Summary */}
        {habits.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-6 bg-gradient-to-r from-[#800020]/10 to-[#DCAE96]/10 border-2 border-primary/20 rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#800020] to-[#DCAE96] flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Today's Progress</h3>
                  <p className="text-muted-foreground">Keep up the great work!</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">{todayCompleted}/{totalHabits}</div>
                <p className="text-sm text-muted-foreground">Habits Completed</p>
              </div>
            </div>
            {totalHabits > 0 && (
              <div className="mt-4">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(todayCompleted / totalHabits) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-[#800020] to-[#DCAE96] rounded-full"
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="mb-8 p-6 bg-card rounded-2xl shadow-lg border border-border"
          >
            <h3 className="text-xl font-bold text-foreground mb-4">
              Create New Habit
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Habit Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Morning Meditation"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this habit mean to you?"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
                >
                  Create Habit
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 bg-muted text-muted-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        )}

        {habits.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <p className="text-muted-foreground mb-4">
              No habits yet. Create your first one to get started!
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Habit
                    </th>
                    {last7Days.map(day => (
                      <th key={day.date} className="px-3 py-4 text-center">
                        <div className="text-xs font-medium text-muted-foreground">
                          {day.day}
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {day.dayNum}
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {habits.map((habit, idx) => (
                    <motion.tr
                      key={habit.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${habit.color}`} />
                          <div>
                            <div className="font-semibold text-foreground">
                              {habit.name}
                            </div>
                            {habit.description && (
                              <div className="text-sm text-muted-foreground">
                                {habit.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {last7Days.map(day => {
                        const isCompleted = habit.completedDates.includes(day.date);
                        return (
                          <td key={day.date} className="px-3 py-4 text-center">
                            <button
                              onClick={() => handleToggleCompletion(habit.id, day.date, isCompleted)}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                isCompleted
                                  ? `bg-gradient-to-br ${habit.color} text-white shadow-md`
                                  : 'bg-muted hover:bg-muted/80'
                              }`}
                            >
                              {isCompleted && <Check className="w-5 h-5" />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {habits.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {habits.map((habit, idx) => {
              const last30Days = Array.from({ length: 30 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                return d.toISOString().split('T')[0];
              });
              const completedCount = last30Days.filter(date => 
                habit.completedDates.includes(date)
              ).length;
              const streak = (() => {
                let count = 0;
                for (let i = 0; i < 30; i++) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const date = d.toISOString().split('T')[0];
                  if (habit.completedDates.includes(date)) {
                    count++;
                  } else {
                    break;
                  }
                }
                return count;
              })();

              return (
                <motion.div
                  key={habit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-6 bg-card rounded-xl shadow-lg border border-border"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${habit.color}`} />
                    <h3 className="font-semibold text-foreground">
                      {habit.name}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        30-day completion
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {completedCount}/30
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Current streak
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {streak} days
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}