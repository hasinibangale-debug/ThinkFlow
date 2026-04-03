import { addMinutes, differenceInMinutes, parseISO } from "date-fns";
import { clamp, pointsByBand, safeAvg } from "../utils.js";
import type {
  AdaptiveMode,
  BreakRecommendation,
  CodingSession,
  MoodEntry,
  PersonalityMode,
  TypingSnapshot,
} from "../types/domain.js";

const breakCatalog: Array<Pick<BreakRecommendation, "type" | "recommendedMinutes">> = [
  { type: "micro-stretch", recommendedMinutes: 3 },
  { type: "hydration", recommendedMinutes: 2 },
  { type: "eye-rest", recommendedMinutes: 2 },
  { type: "walk", recommendedMinutes: 7 },
  { type: "breathing", recommendedMinutes: 4 },
];

export function determineAdaptiveMode(input: {
  recentSnapshots: TypingSnapshot[];
  recentMoods: MoodEntry[];
}): { mode: AdaptiveMode; reason: string } {
  const recentVibe = safeAvg(input.recentSnapshots.map((s) => s.vibeScore));
  const frustrationHits = input.recentSnapshots.filter((s) => s.emotionSignal === "frustration").length;
  const confidenceHits = input.recentSnapshots.filter((s) => s.emotionSignal === "confidence").length;
  const avgEnergy = safeAvg(input.recentMoods.map((m) => m.energy));

  if (frustrationHits >= 2 || recentVibe < 45 || avgEnergy < 4.5) {
    return {
      mode: "gentle",
      reason: "Frustration and fatigue detected; reduce cognitive load with simpler suggestions.",
    };
  }

  if (confidenceHits >= 2 && recentVibe > 72 && avgEnergy >= 7) {
    return {
      mode: "challenge",
      reason: "Strong confidence and energy detected; unlock optimization and best-practice nudges.",
    };
  }

  return {
    mode: "balanced",
    reason: "Signals are mixed; keep standard guidance with adaptive monitoring.",
  };
}

export function buildBreakRecommendation(input: {
  userId: string;
  session?: CodingSession;
  latestMood?: MoodEntry;
  latestSnapshot?: TypingSnapshot;
  nowIso: string;
}): Omit<BreakRecommendation, "id"> {
  const now = parseISO(input.nowIso);
  const sessionDuration = input.session?.startedAt
    ? differenceInMinutes(now, parseISO(input.session.startedAt))
    : input.session?.totalDurationMin ?? 0;

  const fatigueComposite = clamp(
    safeAvg([
      sessionDuration / 120,
      input.latestMood ? 1 - input.latestMood.energy / 10 : 0.4,
      input.latestSnapshot ? 1 - input.latestSnapshot.vibeScore / 100 : 0.45,
    ]),
    0,
    1,
  );

  const pickIndex = Math.floor(fatigueComposite * (breakCatalog.length - 1));
  const pick = breakCatalog[pickIndex];
  const recommendedMinutes = Math.max(pick.recommendedMinutes, Math.round(2 + fatigueComposite * 8));

  let reason = "Routine recovery break to sustain focus.";
  if (sessionDuration >= 90) {
    reason = `Long coding session (${sessionDuration}m) detected; micro-break recommended.`;
  }
  if (input.latestSnapshot?.emotionSignal === "frustration") {
    reason = "Frustration signal detected from typing telemetry; reset with a short break.";
  }

  return {
    userId: input.userId,
    createdAt: input.nowIso,
    type: pick.type,
    reason,
    recommendedMinutes,
  };
}

export function evaluateFatigueRisk(session: CodingSession, snapshots: TypingSnapshot[]): "low" | "medium" | "high" {
  const vibe = safeAvg(snapshots.map((s) => s.vibeScore));
  const prolongedWorkPenalty = clamp(session.totalDurationMin / 180, 0, 1);
  const frustrationPenalty = snapshots.filter((s) => s.emotionSignal === "frustration").length / Math.max(snapshots.length, 1);

  const riskScore = 100 * safeAvg([
    1 - vibe / 100,
    prolongedWorkPenalty,
    frustrationPenalty,
  ]);

  return pointsByBand(riskScore, 34, 67);
}

export function styleCompanionMessage(mode: PersonalityMode, adaptiveMode: AdaptiveMode): string {
  if (mode === "strict-mentor") {
    if (adaptiveMode === "gentle") {
      return "Refactor one small issue now, then take a 3-minute reset. Discipline includes recovery.";
    }
    if (adaptiveMode === "challenge") {
      return "You are in peak form. Attempt the harder optimization path and justify complexity trade-offs.";
    }
    return "Ship clean logic, review edge cases, and avoid context switching for the next 25 minutes.";
  }

  if (mode === "interviewer") {
    if (adaptiveMode === "gentle") {
      return "Pause and answer: what caused the bug, and how would you explain the fix in under 90 seconds?";
    }
    if (adaptiveMode === "challenge") {
      return "Interview drill: optimize this path for scale and defend your chosen data structure.";
    }
    return "Design question: how would this feature behave under partial network failure?";
  }

  if (adaptiveMode === "gentle") {
    return "You are doing fine. Take a short breather and we can tackle the next step together.";
  }
  if (adaptiveMode === "challenge") {
    return "Great momentum. Want to try an advanced refactor challenge for bonus points?";
  }
  return "Steady progress. Keep this pace and hydrate after this block.";
}

export function nextNudgeTime(nowIso: string, adaptiveMode: AdaptiveMode): string {
  const now = parseISO(nowIso);
  const delta = adaptiveMode === "gentle" ? 20 : adaptiveMode === "challenge" ? 35 : 28;
  return addMinutes(now, delta).toISOString();
}
