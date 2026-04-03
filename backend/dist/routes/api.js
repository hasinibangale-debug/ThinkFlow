import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../storage/db.js";
import { rollingRange, toIsoDate } from "../utils.js";
import { buildBreakRecommendation, determineAdaptiveMode, evaluateFatigueRisk, nextNudgeTime, styleCompanionMessage, } from "../services/adaptiveCompanion.js";
import { buildCircadianDashboard, buildManualCircadianGraph, filterIsoWindow, inferHabitLogFromSnapshots, } from "../services/circadianInsights.js";
import { computeSessionVibeAverage, fuseMoodSignals, inferEmotionFromTyping, } from "../services/emotionEngine.js";
export const apiRouter = Router();
const createUserSchema = z.object({
    displayName: z.string().min(2),
    timezone: z.string().default("UTC"),
    personalityMode: z.enum(["strict-mentor", "friendly-buddy", "interviewer"]).default("friendly-buddy"),
});
const updatePersonalitySchema = z.object({
    personalityMode: z.enum(["strict-mentor", "friendly-buddy", "interviewer"]),
});
const sleepSchema = z.object({
    userId: z.string().min(1),
    source: z.enum(["wearable", "manual"]),
    sleepStart: z.string().datetime(),
    sleepEnd: z.string().datetime(),
    score: z.number().min(0).max(100),
});
const manualMoodSchema = z.object({
    userId: z.string().min(1),
    timestamp: z.string().datetime().optional(),
    mood: z.enum(["calm", "frustrated", "energetic", "fatigued", "neutral"]),
    energy: z.number().min(1).max(10),
    notes: z.string().max(600).optional(),
});
const typingSnapshotSchema = z.object({
    userId: z.string().min(1),
    timestamp: z.string().datetime().optional(),
    charsTyped: z.number().int().min(0),
    wordsTyped: z.number().int().min(0),
    backspaces: z.number().int().min(0),
    errorCount: z.number().int().min(0),
    pauseMs: z.number().int().min(0),
    durationMs: z.number().int().min(1000),
});
const startSessionSchema = z.object({
    userId: z.string().min(1),
    startedAt: z.string().datetime().optional(),
});
const endSessionSchema = z.object({
    endedAt: z.string().datetime().optional(),
});
const extensionLinkSchema = z.object({
    userId: z.string().min(1),
    ide: z.enum(["vscode", "intellij", "pycharm", "jetbrains"]).default("vscode"),
    installId: z.string().min(4),
});
const quizSchema = z.object({
    userId: z.string().min(1),
    prompt: z.string().min(5),
    correct: z.boolean(),
});
const manualCircadianLogSchema = z.object({
    userId: z.string().min(1).optional(),
    timestamp: z.string().datetime().optional(),
    mood: z.enum(["calm", "frustrated", "energetic", "fatigued", "neutral"]),
    energy: z.number().min(1).max(10),
    sleepHours: z.number().min(0).max(14),
    sleepScore: z.number().min(0).max(100),
    focusScore: z.number().min(0).max(10),
    stressScore: z.number().min(0).max(10),
    notes: z.string().max(800).optional(),
});
const typingBridgeSchema = z.object({
    mood: z.string().min(1).default("Neutral"),
    score: z.number().min(0).max(100).optional(),
});
const faceBridgeSchema = z.object({
    emotion: z.string().min(1).default("Neutral"),
});
function ensureDefaultUser() {
    const existing = db.data.users[0];
    if (existing) {
        return existing;
    }
    const created = {
        id: nanoid(),
        displayName: "ThinkFlow User",
        createdAt: new Date().toISOString(),
        personalityMode: "friendly-buddy",
        timezone: "UTC",
    };
    db.data.users.push(created);
    return created;
}
apiRouter.get("/health", (_req, res) => {
    res.json({ ok: true, service: "thinkflow-backend", timestamp: new Date().toISOString() });
});
apiRouter.get("/", (_req, res) => {
    res.json({ message: "API running" });
});
apiRouter.post("/users", async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const now = new Date().toISOString();
    const user = {
        id: nanoid(),
        displayName: parsed.data.displayName,
        createdAt: now,
        personalityMode: parsed.data.personalityMode,
        timezone: parsed.data.timezone,
    };
    db.data.users.push(user);
    await db.write();
    res.status(201).json(user);
});
apiRouter.get("/users/:userId", (req, res) => {
    const user = db.data.users.find((entry) => entry.id === req.params.userId);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
});
apiRouter.get("/users/default", async (_req, res) => {
    const user = ensureDefaultUser();
    await db.write();
    res.json(user);
});
apiRouter.patch("/users/:userId/personality", async (req, res) => {
    const parsed = updatePersonalitySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const user = db.data.users.find((entry) => entry.id === req.params.userId);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    user.personalityMode = parsed.data.personalityMode;
    await db.write();
    res.json(user);
});
apiRouter.post("/sleep", async (req, res) => {
    const parsed = sleepSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    if (new Date(parsed.data.sleepEnd) <= new Date(parsed.data.sleepStart)) {
        return res.status(400).json({ error: "sleepEnd must be after sleepStart" });
    }
    const qualityTag = parsed.data.score >= 85
        ? "excellent"
        : parsed.data.score >= 70
            ? "good"
            : parsed.data.score >= 50
                ? "fair"
                : "poor";
    const typedQualityTag = qualityTag;
    const entry = {
        id: nanoid(),
        ...parsed.data,
        qualityTag: typedQualityTag,
        createdAt: new Date().toISOString(),
    };
    db.data.sleepLogs.push(entry);
    await db.write();
    res.status(201).json(entry);
});
apiRouter.post("/moods/manual", async (req, res) => {
    const parsed = manualMoodSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const latestAiSnapshot = db.data.typingSnapshots
        .filter((snapshot) => snapshot.userId === parsed.data.userId)
        .at(-1);
    const fused = fuseMoodSignals({
        manualMood: parsed.data.mood,
        manualEnergy: parsed.data.energy,
        aiSignal: latestAiSnapshot?.emotionSignal ?? "neutral",
        latestVibeScore: latestAiSnapshot?.vibeScore ?? 50,
    });
    const now = parsed.data.timestamp ?? new Date().toISOString();
    const manualEntry = {
        id: nanoid(),
        userId: parsed.data.userId,
        timestamp: now,
        mood: parsed.data.mood,
        energy: parsed.data.energy,
        notes: parsed.data.notes,
        source: "manual",
        confidence: 0.95,
    };
    const fusedEntry = {
        id: nanoid(),
        userId: parsed.data.userId,
        timestamp: now,
        mood: fused.fusedMood,
        energy: parsed.data.energy,
        notes: parsed.data.notes,
        source: "fused",
        confidence: Number(fused.confidence.toFixed(2)),
    };
    db.data.moodEntries.push(manualEntry, fusedEntry);
    await db.write();
    res.status(201).json({ manualEntry, fusedEntry });
});
apiRouter.post("/telemetry/typing", async (req, res) => {
    const parsed = typingSnapshotSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const analysis = inferEmotionFromTyping(parsed.data);
    const snapshot = {
        id: nanoid(),
        ...parsed.data,
        timestamp: parsed.data.timestamp ?? new Date().toISOString(),
        typingSpeedWpm: analysis.typingSpeedWpm,
        emotionSignal: analysis.emotionSignal,
        vibeScore: analysis.vibeScore,
    };
    db.data.typingSnapshots.push(snapshot);
    const aiMood = {
        frustration: "frustrated",
        confidence: "energetic",
        neutral: "neutral",
    };
    db.data.moodEntries.push({
        id: nanoid(),
        userId: parsed.data.userId,
        timestamp: snapshot.timestamp,
        mood: aiMood[analysis.emotionSignal],
        energy: Math.max(1, Math.round(snapshot.vibeScore / 10)),
        source: "ai",
        confidence: Number((0.6 + snapshot.vibeScore / 250).toFixed(2)),
    });
    const today = toIsoDate(new Date(snapshot.timestamp));
    const existingHabit = db.data.habitLogs.find((entry) => entry.userId === parsed.data.userId && entry.date === today);
    if (!existingHabit) {
        const inferred = inferHabitLogFromSnapshots(parsed.data.userId, db.data.typingSnapshots.filter((entry) => entry.userId === parsed.data.userId), today);
        db.data.habitLogs.push(inferred);
    }
    await db.write();
    res.status(201).json(snapshot);
});
apiRouter.post("/sessions/start", async (req, res) => {
    const parsed = startSessionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const openSession = db.data.codingSessions.find((session) => session.userId === parsed.data.userId && !session.endedAt);
    if (openSession) {
        return res.status(409).json({ error: "User already has an active session", sessionId: openSession.id });
    }
    const startedAt = parsed.data.startedAt ?? new Date().toISOString();
    const session = {
        id: nanoid(),
        userId: parsed.data.userId,
        startedAt,
        totalDurationMin: 0,
        averageVibeScore: 50,
        fatigueRisk: "low",
    };
    db.data.codingSessions.push(session);
    await db.write();
    res.status(201).json(session);
});
apiRouter.post("/sessions/:sessionId/end", async (req, res) => {
    const parsed = endSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const session = db.data.codingSessions.find((entry) => entry.id === req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }
    const endTime = parsed.data.endedAt ?? new Date().toISOString();
    session.endedAt = endTime;
    const startMs = new Date(session.startedAt).getTime();
    const endMs = new Date(endTime).getTime();
    session.totalDurationMin = Math.max(1, Math.round((endMs - startMs) / 60000));
    const snapshots = db.data.typingSnapshots.filter((snapshot) => snapshot.userId === session.userId && new Date(snapshot.timestamp) >= new Date(session.startedAt) && new Date(snapshot.timestamp) <= new Date(endTime));
    session.averageVibeScore = computeSessionVibeAverage(snapshots);
    session.fatigueRisk = evaluateFatigueRisk(session, snapshots);
    await db.write();
    res.json(session);
});
apiRouter.get("/dashboard/:userId", (req, res) => {
    const userId = req.params.userId;
    const from = typeof req.query.from === "string" ? req.query.from : rollingRange(14).from;
    const to = typeof req.query.to === "string" ? req.query.to : rollingRange(14).to;
    const sleepLogs = filterIsoWindow(db.data.sleepLogs.filter((entry) => entry.userId === userId), from, to);
    const moods = filterIsoWindow(db.data.moodEntries.filter((entry) => entry.userId === userId), from, to);
    const snapshots = filterIsoWindow(db.data.typingSnapshots.filter((entry) => entry.userId === userId), from, to);
    const habitLogs = filterIsoWindow(db.data.habitLogs.filter((entry) => entry.userId === userId), from, to);
    const circadian = buildCircadianDashboard({
        sleepLogs,
        moodEntries: moods,
        typingSnapshots: snapshots,
        habitLogs,
        manualLogs: filterIsoWindow(db.data.manualCircadianLogs.filter((entry) => entry.userId === userId), from, to),
    });
    const adaptive = determineAdaptiveMode({
        recentSnapshots: snapshots.slice(-8),
        recentMoods: moods.slice(-8),
    });
    res.json({
        userId,
        from,
        to,
        circadian,
        adaptive,
        counts: {
            sleepLogs: sleepLogs.length,
            moods: moods.length,
            telemetry: snapshots.length,
            habits: habitLogs.length,
        },
    });
});
apiRouter.post("/manual/logs", async (req, res) => {
    const parsed = manualCircadianLogSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const defaultUser = ensureDefaultUser();
    const resolvedUserId = parsed.data.userId ?? defaultUser.id;
    const entry = {
        id: nanoid(),
        ...parsed.data,
        userId: resolvedUserId,
        timestamp: parsed.data.timestamp ?? new Date().toISOString(),
    };
    db.data.manualCircadianLogs.push(entry);
    await db.write();
    return res.status(201).json(entry);
});
apiRouter.get("/manual/logs/:userId/graph", (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : rollingRange(14).from;
    const to = typeof req.query.to === "string" ? req.query.to : rollingRange(14).to;
    const logs = filterIsoWindow(db.data.manualCircadianLogs.filter((entry) => entry.userId === req.params.userId), from, to);
    const graph = buildManualCircadianGraph(logs);
    return res.json({
        userId: req.params.userId,
        from,
        to,
        count: logs.length,
        graph,
    });
});
apiRouter.get("/manual/logs/graph", async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : rollingRange(14).from;
    const to = typeof req.query.to === "string" ? req.query.to : rollingRange(14).to;
    const userId = typeof req.query.userId === "string" ? req.query.userId : ensureDefaultUser().id;
    const logs = filterIsoWindow(db.data.manualCircadianLogs.filter((entry) => entry.userId === userId), from, to);
    const graph = buildManualCircadianGraph(logs);
    await db.write();
    return res.json({
        userId,
        from,
        to,
        count: logs.length,
        graph,
    });
});
apiRouter.post("/typing", async (req, res) => {
    const parsed = typingBridgeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    db.data.emotionBridge.typingMood = parsed.data.mood;
    db.data.emotionBridge.updatedAt = new Date().toISOString();
    await db.write();
    return res.json({ status: "ok" });
});
apiRouter.post("/face", async (req, res) => {
    const parsed = faceBridgeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    db.data.emotionBridge.faceMood = parsed.data.emotion;
    db.data.emotionBridge.updatedAt = new Date().toISOString();
    await db.write();
    return res.json({ status: "ok" });
});
apiRouter.get("/emotion", (_req, res) => {
    res.json({
        typingMood: db.data.emotionBridge.typingMood,
        faceMood: db.data.emotionBridge.faceMood,
        updatedAt: db.data.emotionBridge.updatedAt,
    });
});
apiRouter.get("/companion/:userId", async (req, res) => {
    const user = db.data.users.find((entry) => entry.id === req.params.userId);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    const nowIso = new Date().toISOString();
    const moods = db.data.moodEntries.filter((entry) => entry.userId === user.id).slice(-8);
    const snapshots = db.data.typingSnapshots.filter((entry) => entry.userId === user.id).slice(-8);
    const activeSession = db.data.codingSessions.find((entry) => entry.userId === user.id && !entry.endedAt);
    const adaptive = determineAdaptiveMode({
        recentSnapshots: snapshots,
        recentMoods: moods,
    });
    const rec = buildBreakRecommendation({
        userId: user.id,
        session: activeSession,
        latestMood: moods.at(-1),
        latestSnapshot: snapshots.at(-1),
        nowIso,
    });
    const recommendation = {
        id: nanoid(),
        ...rec,
    };
    db.data.breakRecommendations.push(recommendation);
    await db.write();
    res.json({
        adaptiveMode: adaptive.mode,
        modeReason: adaptive.reason,
        botPersonality: user.personalityMode,
        companionMessage: styleCompanionMessage(user.personalityMode, adaptive.mode),
        nextNudgeAt: nextNudgeTime(nowIso, adaptive.mode),
        breakRecommendation: recommendation,
        ideHints: adaptive.mode === "gentle"
            ? ["Short autocomplete snippets", "Reduced hint verbosity", "Stepwise guidance"]
            : adaptive.mode === "challenge"
                ? ["Optimization prompts", "Complexity nudges", "Best-practice challenges"]
                : ["Standard suggestions", "Periodic health reminders"],
    });
});
apiRouter.post("/extension/link", async (req, res) => {
    const parsed = extensionLinkSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const link = {
        id: nanoid(),
        userId: parsed.data.userId,
        ide: parsed.data.ide,
        installId: parsed.data.installId,
        linkedAt: new Date().toISOString(),
        linkCode: `TF-${nanoid(8).toUpperCase()}`,
    };
    db.data.extensionLinks.push(link);
    await db.write();
    res.status(201).json(link);
});
apiRouter.post("/extension/events/typing", async (req, res) => {
    const parsed = typingSnapshotSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const analysis = inferEmotionFromTyping(parsed.data);
    const snapshot = {
        id: nanoid(),
        ...parsed.data,
        timestamp: parsed.data.timestamp ?? new Date().toISOString(),
        typingSpeedWpm: analysis.typingSpeedWpm,
        emotionSignal: analysis.emotionSignal,
        vibeScore: analysis.vibeScore,
    };
    db.data.typingSnapshots.push(snapshot);
    await db.write();
    const recentSnapshots = db.data.typingSnapshots.filter((s) => s.userId === parsed.data.userId).slice(-6);
    const recentMoods = db.data.moodEntries.filter((m) => m.userId === parsed.data.userId).slice(-6);
    const adaptive = determineAdaptiveMode({ recentSnapshots, recentMoods });
    return res.status(201).json({
        snapshot,
        adaptiveMode: adaptive.mode,
        reason: adaptive.reason,
        vibeScore: snapshot.vibeScore,
    });
});
apiRouter.post("/gamification/quiz-attempt", async (req, res) => {
    const parsed = quizSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const points = parsed.data.correct ? 12 : 3;
    const attempt = {
        id: nanoid(),
        userId: parsed.data.userId,
        createdAt: new Date().toISOString(),
        prompt: parsed.data.prompt,
        correct: parsed.data.correct,
        pointsAwarded: points,
    };
    const reward = {
        id: nanoid(),
        userId: parsed.data.userId,
        createdAt: attempt.createdAt,
        reason: parsed.data.correct ? "Quiz solved during break" : "Quiz attempted during break",
        points,
    };
    db.data.quizAttempts.push(attempt);
    db.data.rewardEvents.push(reward);
    await db.write();
    res.status(201).json({ attempt, reward });
});
apiRouter.get("/gamification/:userId/score", (req, res) => {
    const rewards = db.data.rewardEvents.filter((entry) => entry.userId === req.params.userId);
    const totalPoints = rewards.reduce((sum, reward) => sum + reward.points, 0);
    res.json({
        userId: req.params.userId,
        totalPoints,
        rewards,
        badge: totalPoints >= 200
            ? "Legend"
            : totalPoints >= 120
                ? "Momentum Builder"
                : totalPoints >= 60
                    ? "Focused Explorer"
                    : "Starter",
    });
});
