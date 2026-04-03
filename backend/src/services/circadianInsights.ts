import { parseISO, getHours, isWithinInterval, startOfHour, addHours } from "date-fns";
import { clamp, safeAvg } from "../utils.js";
import type { HabitLog, ManualCircadianLog, MoodEntry, SleepLog, TypingSnapshot } from "../types/domain.js";

interface DashboardInput {
  sleepLogs: SleepLog[];
  moodEntries: MoodEntry[];
  typingSnapshots: TypingSnapshot[];
  habitLogs: HabitLog[];
  manualLogs?: ManualCircadianLog[];
}

export function buildCircadianDashboard(input: DashboardInput) {
  const sleepScore = Number(safeAvg(input.sleepLogs.map((s) => s.score)).toFixed(1));

  const hourlyBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    productivity: 0,
    fatigue: 0,
    samples: 0,
  }));

  input.typingSnapshots.forEach((snapshot) => {
    const hour = getHours(parseISO(snapshot.timestamp));
    const bucket = hourlyBuckets[hour];
    bucket.productivity += snapshot.vibeScore;
    bucket.fatigue += 100 - snapshot.vibeScore;
    bucket.samples += 1;
  });

  const graphData = hourlyBuckets.map((bucket) => ({
    hour: bucket.hour,
    productivity: bucket.samples > 0 ? Number((bucket.productivity / bucket.samples).toFixed(1)) : null,
    fatigue: bucket.samples > 0 ? Number((bucket.fatigue / bucket.samples).toFixed(1)) : null,
  }));

  const completedBuckets = graphData.filter((point) => point.productivity !== null) as Array<{
    hour: number;
    productivity: number;
    fatigue: number;
  }>;

  const peak = completedBuckets.reduce(
    (best, current) => (current.productivity > best.productivity ? current : best),
    { hour: 10, productivity: 55, fatigue: 45 },
  );

  const dip = completedBuckets.reduce(
    (worst, current) => (current.fatigue > worst.fatigue ? current : worst),
    { hour: 15, productivity: 45, fatigue: 55 },
  );

  const lateNightCodingDays = input.habitLogs.filter((h) => h.lateNightCoding).length;
  const irregularBreakDays = input.habitLogs.filter((h) => h.irregularBreaks).length;

  const moodEnergy = safeAvg(input.moodEntries.map((m) => m.energy));
  const manualEnergy = safeAvg((input.manualLogs ?? []).map((log) => log.energy));
  const mergedEnergy = safeAvg([moodEnergy || 0, manualEnergy || 0].filter((v) => v > 0));
  const resilienceScore = Number(
    clamp(
      safeAvg([
        sleepScore / 100,
        (mergedEnergy || moodEnergy) / 10,
        1 - irregularBreakDays / Math.max(input.habitLogs.length, 1),
      ]) * 100,
      0,
      100,
    ).toFixed(1),
  );

  return {
    summary: {
      avgSleepScore: sleepScore || 0,
      avgEnergy: Number((mergedEnergy || moodEnergy).toFixed(1)) || 0,
      resilienceScore,
      lateNightCodingDays,
      irregularBreakDays,
      productivePeakHour: peak.hour,
      fatigueDipHour: dip.hour,
    },
    productivityGraph: graphData,
    recommendations: [
      `Schedule deep work around ${formatHour(peak.hour)} when your productivity tends to peak.`,
      `Protect ${formatHour(dip.hour)} for lighter tasks to reduce burnout risk.`,
      lateNightCodingDays > 3
        ? "Late-night coding is frequent. Add a wind-down alarm 60 minutes before bedtime."
        : "Your late-night coding pattern is stable. Keep a consistent shutdown routine.",
      irregularBreakDays > 3
        ? "Break cadence is irregular. Add micro-breaks every 25 to 30 minutes."
        : "Break cadence looks healthy. Maintain hydration and eye-rest intervals.",
    ],
  };
}

export function buildManualCircadianGraph(logs: ManualCircadianLog[]) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    energyTotal: 0,
    stressTotal: 0,
    focusTotal: 0,
    sleepTotal: 0,
    count: 0,
  }));

  logs.forEach((log) => {
    const hour = getHours(parseISO(log.timestamp));
    const bucket = buckets[hour];
    bucket.energyTotal += log.energy;
    bucket.stressTotal += log.stressScore;
    bucket.focusTotal += log.focusScore;
    bucket.sleepTotal += log.sleepScore;
    bucket.count += 1;
  });

  return buckets.map((bucket) => ({
    hour: bucket.hour,
    energy: bucket.count > 0 ? Number((bucket.energyTotal / bucket.count).toFixed(1)) : null,
    stress: bucket.count > 0 ? Number((bucket.stressTotal / bucket.count).toFixed(1)) : null,
    focus: bucket.count > 0 ? Number((bucket.focusTotal / bucket.count).toFixed(1)) : null,
    sleepReadiness: bucket.count > 0 ? Number((bucket.sleepTotal / bucket.count).toFixed(1)) : null,
  }));
}

export function filterIsoWindow<T extends { timestamp?: string; createdAt?: string; startedAt?: string; date?: string }>(
  values: T[],
  fromIso: string,
  toIso: string,
): T[] {
  const from = parseISO(fromIso);
  const to = parseISO(toIso);

  return values.filter((entry) => {
    const raw = entry.timestamp ?? entry.createdAt ?? entry.startedAt ?? entry.date;
    if (!raw) return false;
    const parsed = parseISO(raw);
    return isWithinInterval(parsed, { start: from, end: to });
  });
}

export function inferHabitLogFromSnapshots(userId: string, snapshots: TypingSnapshot[], dayIso: string): HabitLog {
  const dayStart = startOfHour(parseISO(`${dayIso}T00:00:00.000Z`));
  const dayEnd = addHours(dayStart, 24);
  const sameDay = snapshots.filter((snapshot) => {
    const ts = parseISO(snapshot.timestamp);
    return ts >= dayStart && ts < dayEnd;
  });

  const lateNightCoding = sameDay.some((snapshot) => {
    const hour = getHours(parseISO(snapshot.timestamp));
    return hour >= 23 || hour <= 4;
  });

  const longPauses = sameDay.filter((snapshot) => snapshot.pauseMs > 120000).length;

  return {
    id: `${userId}-${dayIso}`,
    userId,
    date: dayIso,
    lateNightCoding,
    irregularBreaks: longPauses > 2,
    breaksTaken: Math.max(0, Math.floor((sameDay.length - longPauses) / 4)),
  };
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${suffix}`;
}
