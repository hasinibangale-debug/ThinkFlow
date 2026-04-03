export type IdeName = "vscode" | "intellij" | "pycharm" | "jetbrains";

export type PersonalityMode = "strict-mentor" | "friendly-buddy" | "interviewer";

export type MoodLabel = "calm" | "frustrated" | "energetic" | "fatigued" | "neutral";

export type AdaptiveMode = "gentle" | "challenge" | "balanced";

export interface UserProfile {
  id: string;
  displayName: string;
  createdAt: string;
  personalityMode: PersonalityMode;
  timezone: string;
}

export interface SleepLog {
  id: string;
  userId: string;
  source: "wearable" | "manual";
  sleepStart: string;
  sleepEnd: string;
  score: number;
  qualityTag: "poor" | "fair" | "good" | "excellent";
  createdAt: string;
}

export interface MoodEntry {
  id: string;
  userId: string;
  timestamp: string;
  mood: MoodLabel;
  energy: number;
  notes?: string;
  source: "manual" | "ai" | "fused";
  confidence: number;
}

export interface TypingSnapshot {
  id: string;
  userId: string;
  timestamp: string;
  charsTyped: number;
  wordsTyped: number;
  backspaces: number;
  errorCount: number;
  pauseMs: number;
  durationMs: number;
  typingSpeedWpm: number;
  emotionSignal: "frustration" | "confidence" | "neutral";
  vibeScore: number;
}

export interface CodingSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  totalDurationMin: number;
  averageVibeScore: number;
  fatigueRisk: "low" | "medium" | "high";
}

export interface HabitLog {
  id: string;
  userId: string;
  date: string;
  lateNightCoding: boolean;
  irregularBreaks: boolean;
  breaksTaken: number;
}

export interface ExtensionLink {
  id: string;
  userId: string;
  ide: IdeName;
  installId: string;
  linkedAt: string;
  linkCode: string;
}

export interface BreakRecommendation {
  id: string;
  userId: string;
  createdAt: string;
  type: "micro-stretch" | "hydration" | "eye-rest" | "walk" | "breathing";
  reason: string;
  recommendedMinutes: number;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  createdAt: string;
  prompt: string;
  correct: boolean;
  pointsAwarded: number;
}

export interface RewardEvent {
  id: string;
  userId: string;
  createdAt: string;
  reason: string;
  points: number;
}

export interface ManualCircadianLog {
  id: string;
  userId: string;
  timestamp: string;
  mood: MoodLabel;
  energy: number;
  sleepHours: number;
  sleepScore: number;
  focusScore: number;
  stressScore: number;
  notes?: string;
}

export interface EmotionBridgeState {
  typingMood: string;
  faceMood: string;
  updatedAt: string;
}

export interface DbSchema {
  users: UserProfile[];
  sleepLogs: SleepLog[];
  moodEntries: MoodEntry[];
  typingSnapshots: TypingSnapshot[];
  codingSessions: CodingSession[];
  habitLogs: HabitLog[];
  manualCircadianLogs: ManualCircadianLog[];
  emotionBridge: EmotionBridgeState;
  extensionLinks: ExtensionLink[];
  breakRecommendations: BreakRecommendation[];
  quizAttempts: QuizAttempt[];
  rewardEvents: RewardEvent[];
}
