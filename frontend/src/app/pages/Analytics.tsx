import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Target,
  Smile,
  HeartPulse,
} from "lucide-react";
import { Link } from "react-router";
import { useData } from "../contexts/DataContext";
import { motion } from "motion/react";
import { FormEvent, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Analytics() {
  const { habits, moodEntries } = useData();
  const [defaultUserId, setDefaultUserId] = useState("");
  const [manualGraph, setManualGraph] = useState<Array<{ hour: number; energy: number | null; stress: number | null; focus: number | null }>>([]);
  const [logStatus, setLogStatus] = useState("");
  const [manualForm, setManualForm] = useState({
    mood: "calm",
    energy: 6,
    sleepHours: 7,
    sleepScore: 75,
    focusScore: 6,
    stressScore: 4,
    notes: "",
  });

  const pullManualGraph = async (userId = defaultUserId) => {
    try {
      const query = userId ? `?userId=${userId}` : "";
      const res = await fetch(`http://localhost:8080/api/v1/manual/logs/graph${query}`);
      if (!res.ok) {
        return;
      }
      const data = await res.json() as { graph: Array<{ hour: number; energy: number | null; stress: number | null; focus: number | null }> };
      setManualGraph(data.graph ?? []);
    } catch {
      // Keep analytics resilient.
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const userRes = await fetch("http://localhost:8080/api/v1/users/default");
        if (userRes.ok) {
          const user = await userRes.json() as { id: string };
          setDefaultUserId(user.id);
        }
      } catch {
        // Non-blocking fallback.
      }
    };
    void boot();
  }, []);

  useEffect(() => {
    void pullManualGraph(defaultUserId);
    const interval = setInterval(() => {
      void pullManualGraph(defaultUserId);
    }, 5000);

    return () => clearInterval(interval);
  }, [defaultUserId]);

  const submitManualLog = async (event: FormEvent) => {
    event.preventDefault();
    setLogStatus("Saving...");

    try {
      const res = await fetch("http://localhost:8080/api/v1/manual/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: defaultUserId || undefined,
          ...manualForm,
        }),
      });

      if (!res.ok) {
        setLogStatus("Failed to save log.");
        return;
      }

      await pullManualGraph(defaultUserId);
      setLogStatus("Manual log saved.");
      setTimeout(() => setLogStatus(""), 2000);
    } catch {
      setLogStatus("Backend unreachable.");
    }
  };

  // Generate habit completion data for last 30 days
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toISOString().split("T")[0],
      shortDate: `${d.getMonth() + 1}/${d.getDate()}`,
    };
  });

  const habitCompletionData = last30Days.map((day) => {
    const completed = habits.filter((h) =>
      h.completedDates.includes(day.date),
    ).length;
    const total = habits.length;
    return {
      date: day.shortDate,
      completion:
        total > 0 ? Math.round((completed / total) * 100) : 0,
      completed,
      total,
    };
  });

  // Generate mood trend data
  const moodValues = {
    great: 5,
    good: 4,
    okay: 3,
    low: 2,
    tired: 1,
  };

  const moodTrendData = last30Days
    .map((day) => {
      const dayMoods = moodEntries.filter((m) =>
        m.date.startsWith(day.date),
      );
      const avgMood =
        dayMoods.length > 0
          ? dayMoods.reduce(
              (sum, m) => sum + moodValues[m.mood],
              0,
            ) / dayMoods.length
          : 0;
      const avgEnergy =
        dayMoods.length > 0
          ? dayMoods.reduce((sum, m) => sum + m.energy, 0) /
            dayMoods.length
          : 0;
      return {
        date: day.shortDate,
        mood: avgMood ? Number(avgMood.toFixed(1)) : null,
        energy: avgEnergy ? Number(avgEnergy.toFixed(1)) : null,
      };
    })
    .filter((d) => d.mood !== null);

  // Mood distribution
  const moodDistribution = [
    {
      name: "Great",
      value: moodEntries.filter((m) => m.mood === "great")
        .length,
      color: "#10b981",
    },
    {
      name: "Good",
      value: moodEntries.filter((m) => m.mood === "good")
        .length,
      color: "#3b82f6",
    },
    {
      name: "Okay",
      value: moodEntries.filter((m) => m.mood === "okay")
        .length,
      color: "#eab308",
    },
    {
      name: "Low",
      value: moodEntries.filter((m) => m.mood === "low").length,
      color: "#f97316",
    },
    {
      name: "Tired",
      value: moodEntries.filter((m) => m.mood === "tired")
        .length,
      color: "#a855f7",
    },
  ].filter((m) => m.value > 0);

  // Calculate statistics
  const totalHabits = habits.length;
  const avgCompletion =
    habitCompletionData.length > 0
      ? Math.round(
          habitCompletionData.reduce(
            (sum, d) => sum + d.completion,
            0,
          ) / habitCompletionData.length,
        )
      : 0;
  const totalMoodEntries = moodEntries.length;
  const avgEnergy =
    moodEntries.length > 0
      ? (
          moodEntries.reduce((sum, m) => sum + m.energy, 0) /
          moodEntries.length
        ).toFixed(1)
      : 0;

  // Calculate streak
  const currentStreak = (() => {
    let streak = 0;
    for (let i = 0; i < 100; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split("T")[0];
      const completed = habits.filter((h) =>
        h.completedDates.includes(date),
      ).length;
      if (completed > 0) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  })();

  // Generate performance summary
  const generateSummary = () => {
    if (habits.length === 0 && moodEntries.length === 0) {
      return "Start tracking your habits and mood to see your personalized analytics!";
    }

    const summaryParts = [];

    if (habits.length > 0) {
      if (avgCompletion >= 80) {
        summaryParts.push(
          "🌟 Excellent work! Your habit consistency is outstanding.",
        );
      } else if (avgCompletion >= 60) {
        summaryParts.push(
          "👍 Good progress! You're building solid habits.",
        );
      } else if (avgCompletion >= 40) {
        summaryParts.push(
          "📈 You're making progress. Keep pushing forward!",
        );
      } else {
        summaryParts.push(
          "💪 There's room for improvement. Small steps lead to big changes!",
        );
      }

      if (currentStreak > 7) {
        summaryParts.push(
          `You've maintained a ${currentStreak}-day streak - that's amazing!`,
        );
      }
    }

    if (moodEntries.length > 0) {
      const recentMoods = moodEntries.slice(-7);
      const positiveCount = recentMoods.filter(
        (m) => m.mood === "great" || m.mood === "good",
      ).length;

      if (positiveCount >= 5) {
        summaryParts.push(
          "😊 Your mood has been consistently positive lately!",
        );
      } else if (positiveCount >= 3) {
        summaryParts.push(
          "🌤️ Your mood shows a balanced pattern.",
        );
      } else {
        summaryParts.push(
          "🌈 Remember to be kind to yourself during challenging times.",
        );
      }

      if (Number(avgEnergy) >= 7) {
        summaryParts.push(
          `Your energy levels are strong (${avgEnergy}/10).`,
        );
      } else if (Number(avgEnergy) >= 5) {
        summaryParts.push(
          `Your energy is moderate (${avgEnergy}/10). Consider rest and self-care.`,
        );
      } else {
        summaryParts.push(
          `Your energy has been low (${avgEnergy}/10). Prioritize rest and recovery.`,
        );
      }
    }

    return summaryParts.join(" ");
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Analytics & Insights
            </h1>
            <p className="text-muted-foreground">
              Visualize your progress and patterns
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-[#800020] to-[#DCAE96] rounded-2xl p-6 text-white shadow-lg"
          >
            <Target className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">
              {totalHabits}
            </div>
            <div className="text-white/80 text-sm">
              Active Habits
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-[#b08968] to-[#e07a5f] rounded-2xl p-6 text-white shadow-lg"
          >
            <TrendingUp className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">
              {avgCompletion}%
            </div>
            <div className="text-white/80 text-sm">
              Avg Completion (30d)
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-[#DCAE96] to-[#f4a261] rounded-2xl p-6 text-white shadow-lg"
          >
            <Smile className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">
              {totalMoodEntries}
            </div>
            <div className="text-white/80 text-sm">
              Mood Entries
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-[#e07a5f] to-[#f4a261] rounded-2xl p-6 text-white shadow-lg"
          >
            <Calendar className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">
              {currentStreak}
            </div>
            <div className="text-white/80 text-sm">
              Day Streak
            </div>
          </motion.div>
        </div>

        {/* Performance Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8 p-8 bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20 rounded-2xl"
        >
          <h2 className="text-2xl font-bold text-foreground mb-4">
            📊 Performance Summary
          </h2>
          <p className="text-foreground/80 text-lg leading-relaxed">
            {generateSummary()}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mb-8 bg-card border border-border rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-4">
            <HeartPulse className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-bold text-foreground">Manual Circadian Log</h3>
          </div>

          <form onSubmit={submitManualLog} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <select
              value={manualForm.mood}
              onChange={(e) => setManualForm((prev) => ({ ...prev, mood: e.target.value }))}
              className="rounded-lg border border-border bg-input-background px-3 py-2"
            >
              <option value="calm">Calm</option>
              <option value="frustrated">Frustrated</option>
              <option value="energetic">Energetic</option>
              <option value="fatigued">Fatigued</option>
              <option value="neutral">Neutral</option>
            </select>

            {[
              { key: "energy", label: "Energy (1-10)", min: 1, max: 10 },
              { key: "sleepHours", label: "Sleep Hours", min: 0, max: 14 },
              { key: "sleepScore", label: "Sleep Score (0-100)", min: 0, max: 100 },
              { key: "focusScore", label: "Focus Score (0-10)", min: 0, max: 10 },
              { key: "stressScore", label: "Stress Score (0-10)", min: 0, max: 10 },
            ].map((field) => (
              <label key={field.key} className="flex flex-col gap-1 text-sm text-muted-foreground">
                {field.label}
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={manualForm[field.key as keyof typeof manualForm] as number}
                  onChange={(e) => setManualForm((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
                  className="rounded-lg border border-border bg-input-background px-3 py-2 text-foreground"
                />
              </label>
            ))}

            <textarea
              value={manualForm.notes}
              onChange={(e) => setManualForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="md:col-span-2 rounded-lg border border-border bg-input-background px-3 py-2"
              rows={3}
              placeholder="Optional notes"
            />

            <button
              type="submit"
              className="md:col-span-2 rounded-lg bg-gradient-to-r from-[#800020] to-[#DCAE96] px-4 py-3 text-white font-semibold"
            >
              Save Manual Log
            </button>
            {logStatus && <p className="md:col-span-2 text-sm text-primary">{logStatus}</p>}
          </form>

          <h4 className="text-lg font-bold text-foreground mb-3">Manual Circadian Pattern Graph</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={manualGraph}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Line type="monotone" dataKey="energy" stroke="#800020" strokeWidth={2.2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="stress" stroke="#f97316" strokeWidth={2.2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="focus" stroke="#2563eb" strokeWidth={2.2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Habit Completion Chart */}
          {habits.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-lg"
            >
              <h3 className="text-xl font-bold text-foreground mb-6">
                Habit Completion Rate (30 Days)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={habitCompletionData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.1}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="currentColor"
                    tick={{
                      fontSize: 11,
                      fill: "currentColor",
                    }}
                    interval={4}
                  />
                  <YAxis
                    stroke="currentColor"
                    tick={{
                      fontSize: 11,
                      fill: "currentColor",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar
                    dataKey="completion"
                    fill="#800020"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Mood & Energy Trend */}
          {moodTrendData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-lg"
            >
              <h3 className="text-xl font-bold text-foreground mb-6">
                Mood & Energy Trends
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={moodTrendData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.1}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="currentColor"
                    tick={{
                      fontSize: 11,
                      fill: "currentColor",
                    }}
                    interval={4}
                  />
                  <YAxis
                    stroke="currentColor"
                    tick={{
                      fontSize: 11,
                      fill: "currentColor",
                    }}
                    domain={[0, 10]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{
                      color: "var(--foreground)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#800020"
                    strokeWidth={2.5}
                    dot={{ fill: "#800020", r: 4 }}
                    name="Mood (1-5)"
                  />
                  <Line
                    type="monotone"
                    dataKey="energy"
                    stroke="#DCAE96"
                    strokeWidth={2.5}
                    dot={{ fill: "#DCAE96", r: 4 }}
                    name="Energy (1-10)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Mood Distribution */}
          {moodDistribution.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-lg"
            >
              <h3 className="text-xl font-bold text-foreground mb-6">
                Mood Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={moodDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {moodDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Individual Habit Performance */}
          {habits.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-lg"
            >
              <h3 className="text-xl font-bold text-foreground mb-6">
                Habit Performance (30 Days)
              </h3>
              <div className="space-y-5">
                {habits.map((habit, index) => {
                  const last30 = Array.from(
                    { length: 30 },
                    (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - i);
                      return d.toISOString().split("T")[0];
                    },
                  );
                  const completed = last30.filter((date) =>
                    habit.completedDates.includes(date),
                  ).length;
                  const percentage = Math.round(
                    (completed / 30) * 100,
                  );

                  return (
                    <div key={habit.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full bg-gradient-to-br ${habit.color}`}
                          />
                          <span className="font-medium text-foreground">
                            {habit.name}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground">
                          {completed}/30 ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{
                            delay: 1 + index * 0.1,
                            duration: 0.5,
                          }}
                          className={`h-full bg-gradient-to-r ${habit.color}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* Empty State */}
        {habits.length === 0 && moodEntries.length === 0 && (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl text-muted-foreground mb-6">
              No data to analyze yet
            </p>
            <p className="text-muted-foreground">
              Start tracking your habits and mood to see
              beautiful analytics!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}