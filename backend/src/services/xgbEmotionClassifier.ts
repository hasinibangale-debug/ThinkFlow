import fs from "node:fs";
import path from "node:path";
import { clamp } from "../utils.js";
import { inferEmotionFromTyping, type TypingMetricsInput } from "./emotionEngine.js";

export const TYPING_FEATURE_NAMES = [
  "typingSpeedWpm",
  "backspaceRatio",
  "errorRate",
  "pauseRatio",
  "charsTyped",
  "wordsTyped",
  "backspaces",
  "errorCount",
  "pauseMs",
  "durationMs",
] as const;

export type TypingFeatureName = (typeof TYPING_FEATURE_NAMES)[number];

export type EmotionClass = "frustration" | "confidence" | "neutral";
export const EMOTION_CLASSES: EmotionClass[] = ["frustration", "confidence", "neutral"];

export interface TypingFeatureVector {
  features: Record<TypingFeatureName, number>;
  values: number[];
}

/**
 * Extracts normalized numerical typing features compatible with
 * researchDataService and XGBoost emotion classification.
 */
export function extractTypingFeatures(metrics: TypingMetricsInput): TypingFeatureVector {
  const safeChars = Math.max(0, metrics.charsTyped || 0);
  const safeWords = Math.max(0, metrics.wordsTyped || 0);
  const safeBackspaces = Math.max(0, metrics.backspaces || 0);
  const safeErrors = Math.max(0, metrics.errorCount || 0);
  const safePauseMs = Math.max(0, metrics.pauseMs || 0);
  const safeDurationMs = Math.max(1000, metrics.durationMs || 1000);

  const minutes = Math.max(safeDurationMs / 60000, 0.1);
  const typingSpeedWpm = Number((safeWords / minutes).toFixed(1));
  const backspaceRatio = Number((safeBackspaces / Math.max(safeChars, 1)).toFixed(4));
  const errorRate = Number((safeErrors / Math.max(safeWords, 1)).toFixed(4));
  const pauseRatio = Number((safePauseMs / safeDurationMs).toFixed(4));

  const features: Record<TypingFeatureName, number> = {
    typingSpeedWpm,
    backspaceRatio,
    errorRate,
    pauseRatio,
    charsTyped: safeChars,
    wordsTyped: safeWords,
    backspaces: safeBackspaces,
    errorCount: safeErrors,
    pauseMs: safePauseMs,
    durationMs: safeDurationMs,
  };

  const values = TYPING_FEATURE_NAMES.map((name) => features[name]);

  return { features, values };
}

export interface XGBTreeNode {
  id: number;
  featureIndex?: number;
  featureName?: string;
  splitValue?: number;
  leftId?: number;
  rightId?: number;
  leafValue?: number;
}

export interface XGBTree {
  treeId: number;
  classIndex: number; // 0: frustration, 1: confidence, 2: neutral
  nodes: XGBTreeNode[];
}

export interface XGBoostModelArtifact {
  modelType: "xgboost-multiclass";
  version: string;
  classes: EmotionClass[];
  featureNames: string[];
  baseScores: number[];
  trees: XGBTree[];
  metadata?: {
    description?: string;
    trainedAt?: string;
    sampleCount?: number;
    macroF1?: number;
    accuracy?: number;
  };
}

export interface EmotionPredictionResult {
  emotionSignal: EmotionClass;
  vibeScore: number;
  typingSpeedWpm: number;
  confidence: number;
  probabilities?: Record<EmotionClass, number>;
  source: "xgboost" | "rule-based-fallback";
}

/**
 * Validates whether an object matches the XGBoost model artifact specification.
 */
export function validateModelArtifact(data: unknown): XGBoostModelArtifact | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const obj = data as Partial<XGBoostModelArtifact>;
  if (obj.modelType !== "xgboost-multiclass") {
    return null;
  }

  if (!Array.isArray(obj.classes) || obj.classes.length !== 3) {
    return null;
  }

  if (!Array.isArray(obj.featureNames) || obj.featureNames.length !== TYPING_FEATURE_NAMES.length) {
    return null;
  }

  if (!Array.isArray(obj.trees)) {
    return null;
  }

  for (const tree of obj.trees) {
    if (typeof tree.classIndex !== "number" || tree.classIndex < 0 || tree.classIndex > 2) {
      return null;
    }
    if (!Array.isArray(tree.nodes) || tree.nodes.length === 0) {
      return null;
    }
  }

  return obj as XGBoostModelArtifact;
}

/**
 * Evaluates a single decision tree on the given feature vector.
 */
export function evaluateTree(tree: XGBTree, featureValues: number[]): number {
  const nodeMap = new Map<number, XGBTreeNode>();
  for (const node of tree.nodes) {
    nodeMap.set(node.id, node);
  }

  let current = nodeMap.get(0);
  if (!current) {
    return 0;
  }

  while (current && current.leafValue === undefined) {
    const featureIdx = current.featureIndex ?? 0;
    const splitVal = current.splitValue ?? 0;
    const featureVal = featureValues[featureIdx] ?? 0;

    const nextId = featureVal < splitVal ? current.leftId : current.rightId;
    if (nextId === undefined) {
      break;
    }
    current = nodeMap.get(nextId);
  }

  return current?.leafValue ?? 0;
}

/**
 * Numerically stable multiclass softmax.
 */
export function softmax(margins: number[]): number[] {
  const maxMargin = Math.max(...margins);
  const exps = margins.map((m) => Math.exp(m - maxMargin));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  if (sumExps === 0) {
    return margins.map(() => 1 / margins.length);
  }
  return exps.map((e) => Number((e / sumExps).toFixed(4)));
}

/**
 * XGBoost multiclass emotion classifier with integrated rule-based fallback.
 */
export class XGBoostEmotionClassifier {
  private model: XGBoostModelArtifact | null = null;
  private modelPath: string | null = null;

  constructor(modelPath?: string) {
    if (modelPath) {
      this.loadModel(modelPath);
    }
  }

  public loadModel(source: string | XGBoostModelArtifact): boolean {
    try {
      let artifact: unknown;
      if (typeof source === "string") {
        if (!fs.existsSync(source)) {
          return false;
        }
        const text = fs.readFileSync(source, "utf8");
        artifact = JSON.parse(text);
        this.modelPath = source;
      } else {
        artifact = source;
        this.modelPath = null;
      }

      const validated = validateModelArtifact(artifact);
      if (!validated) {
        this.model = null;
        return false;
      }

      this.model = validated;
      return true;
    } catch {
      this.model = null;
      return false;
    }
  }

  public isModelLoaded(): boolean {
    return this.model !== null;
  }

  public getModelMetadata(): XGBoostModelArtifact["metadata"] | null {
    return this.model?.metadata ?? null;
  }

  public unloadModel(): void {
    this.model = null;
    this.modelPath = null;
  }

  public predict(metrics: TypingMetricsInput): EmotionPredictionResult | null {
    if (!this.model) {
      return null;
    }

    const { features, values } = extractTypingFeatures(metrics);

    // Initialize raw margins from base scores
    const margins = [...(this.model.baseScores ?? [0, 0, 0])];

    // Accumulate leaf values across all gradient boosted trees
    for (const tree of this.model.trees) {
      const leafValue = evaluateTree(tree, values);
      margins[tree.classIndex] += leafValue;
    }

    const probs = softmax(margins);

    // Map probabilities to classes: 0: frustration, 1: confidence, 2: neutral
    const probFrustration = probs[0] ?? 0;
    const probConfidence = probs[1] ?? 0;
    const probNeutral = probs[2] ?? 0;

    let predictedClass: EmotionClass = "neutral";
    let maxProb = probNeutral;

    if (probFrustration > maxProb) {
      predictedClass = "frustration";
      maxProb = probFrustration;
    }
    if (probConfidence > maxProb) {
      predictedClass = "confidence";
      maxProb = probConfidence;
    }

    // Derive continuous vibeScore consistent with ThinkFlow range (0-100)
    // High confidence -> ~85-100, Neutral -> ~50-65, Frustration -> ~10-35
    const vibeScore = Math.round(
      clamp(probConfidence * 90 + probNeutral * 55 + probFrustration * 15, 0, 100),
    );

    return {
      emotionSignal: predictedClass,
      vibeScore,
      typingSpeedWpm: features.typingSpeedWpm,
      confidence: maxProb,
      probabilities: {
        frustration: probFrustration,
        confidence: probConfidence,
        neutral: probNeutral,
      },
      source: "xgboost",
    };
  }

  public predictWithFallback(metrics: TypingMetricsInput): EmotionPredictionResult {
    if (this.isModelLoaded()) {
      const pred = this.predict(metrics);
      if (pred) {
        return pred;
      }
    }

    // Rule-based engine fallback
    const fallback = inferEmotionFromTyping(metrics);
    return {
      emotionSignal: fallback.emotionSignal,
      vibeScore: fallback.vibeScore,
      typingSpeedWpm: fallback.typingSpeedWpm,
      confidence: fallback.emotionSignal === "neutral" ? 0.6 : 0.85,
      source: "rule-based-fallback",
    };
  }
}

export const defaultClassifier = new XGBoostEmotionClassifier();

// Try loading default model if present at standard location
const defaultModelPath =
  process.env.THINKFLOW_MODEL_PATH ?? path.resolve(process.cwd(), "models/xgboost-emotion.json");
if (fs.existsSync(defaultModelPath)) {
  defaultClassifier.loadModel(defaultModelPath);
}

/**
 * Primary emotion inference entry point.
 * Transparently uses XGBoost when available and loaded,
 * smoothly falling back to the rule-based engine otherwise.
 */
export function inferEmotion(metrics: TypingMetricsInput): {
  emotionSignal: "frustration" | "confidence" | "neutral";
  vibeScore: number;
  typingSpeedWpm: number;
  source?: "xgboost" | "rule-based-fallback";
} {
  return defaultClassifier.predictWithFallback(metrics);
}
