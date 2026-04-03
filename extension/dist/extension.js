"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
let currentSessionId;
let flushTimer;
let companionTimer;
let statusBar;
let typing;
function activate(context) {
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
    statusBar.text = "$(pulse) ThinkFlow: idle";
    statusBar.tooltip = "ThinkFlow adaptive coding mode";
    statusBar.show();
    typing = resetAccumulator();
    context.subscriptions.push(statusBar, vscode.commands.registerCommand("thinkflow.linkAccount", () => linkAccount(context)), vscode.commands.registerCommand("thinkflow.startSession", () => startSession()), vscode.commands.registerCommand("thinkflow.endSession", () => endSession()), vscode.commands.registerCommand("thinkflow.setPersonality", () => setPersonalityMode()), vscode.commands.registerCommand("thinkflow.openEmotionMonitor", () => openEmotionMonitor()), vscode.workspace.onDidChangeTextDocument((event) => handleTextChange(event)));
    flushTimer = setInterval(() => {
        void flushTypingTelemetry();
    }, 20000);
    companionTimer = setInterval(() => {
        void pollCompanion();
    }, 120000);
}
function deactivate() {
    if (flushTimer) {
        clearInterval(flushTimer);
    }
    if (companionTimer) {
        clearInterval(companionTimer);
    }
}
async function linkAccount(context) {
    const userId = await vscode.window.showInputBox({
        prompt: "Enter your ThinkFlow user id",
        placeHolder: "e.g., user_abc123",
        ignoreFocusOut: true,
    });
    if (!userId) {
        return;
    }
    const installId = vscode.workspace.getConfiguration("thinkflow").get("installId") ||
        `${vscode.env.machineId.slice(0, 12)}-${Date.now().toString(36)}`;
    await vscode.workspace.getConfiguration("thinkflow").update("userId", userId, vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration("thinkflow").update("installId", installId, vscode.ConfigurationTarget.Global);
    try {
        const payload = {
            userId,
            installId,
            ide: "vscode",
        };
        const response = await postJson("/api/v1/extension/link", payload);
        if (response.ok) {
            const body = response.data;
            void vscode.window.showInformationMessage(`ThinkFlow linked. Link code: ${body.linkCode}`);
        }
        else {
            void vscode.window.showWarningMessage("ThinkFlow user stored locally, but backend link request failed.");
        }
    }
    catch {
        void vscode.window.showWarningMessage("ThinkFlow link failed. Check backend URL in settings.");
    }
    await context.globalState.update("thinkflow.linkedUser", userId);
}
async function startSession() {
    const userId = getUserId();
    if (!userId) {
        void vscode.window.showWarningMessage("Set thinkflow.userId first via ThinkFlow: Link Account.");
        return;
    }
    const response = await postJson("/api/v1/sessions/start", { userId });
    if (!response.ok) {
        void vscode.window.showWarningMessage("Could not start ThinkFlow session.");
        return;
    }
    const body = response.data;
    currentSessionId = body.id;
    typing = resetAccumulator();
    statusBar.text = "$(pulse) ThinkFlow: session live";
    void vscode.window.showInformationMessage("ThinkFlow session started.");
}
async function endSession() {
    if (!currentSessionId) {
        void vscode.window.showInformationMessage("No active ThinkFlow session to end.");
        return;
    }
    await flushTypingTelemetry();
    const response = await postJson(`/api/v1/sessions/${currentSessionId}/end`, {});
    if (!response.ok) {
        void vscode.window.showWarningMessage("Failed to end ThinkFlow session.");
        return;
    }
    currentSessionId = undefined;
    statusBar.text = "$(pulse) ThinkFlow: idle";
    void vscode.window.showInformationMessage("ThinkFlow session ended.");
}
async function setPersonalityMode() {
    const userId = getUserId();
    if (!userId) {
        void vscode.window.showWarningMessage("Set thinkflow.userId first via ThinkFlow: Link Account.");
        return;
    }
    const selected = await vscode.window.showQuickPick([
        { label: "Friendly Buddy", value: "friendly-buddy" },
        { label: "Strict Mentor", value: "strict-mentor" },
        { label: "Interviewer", value: "interviewer" },
    ], { placeHolder: "Select ThinkFlow companion personality" });
    if (!selected) {
        return;
    }
    const response = await patchJson(`/api/v1/users/${userId}/personality`, {
        personalityMode: selected.value,
    });
    if (!response.ok) {
        void vscode.window.showWarningMessage("Failed to update personality mode.");
        return;
    }
    void vscode.window.showInformationMessage(`ThinkFlow personality set to ${selected.label}.`);
}
function openEmotionMonitor() {
    const backendApiFaceUrl = new URL("/api/v1/face", getBackendUrl()).toString();
    const panel = vscode.window.createWebviewPanel("thinkflowEmotionMonitor", "ThinkFlow Emotion Monitor", vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    panel.webview.html = getEmotionMonitorHtml(panel.webview, backendApiFaceUrl);
}
function handleTextChange(event) {
    if (event.contentChanges.length === 0) {
        return;
    }
    const now = Date.now();
    const deltaSinceLast = now - typing.lastEditAt;
    if (typing.lastEditAt > 0 && deltaSinceLast > 1500) {
        typing.pauseMs += deltaSinceLast;
    }
    typing.lastEditAt = now;
    for (const change of event.contentChanges) {
        const inserted = change.text.length;
        const removed = change.rangeLength;
        typing.charsTyped += inserted;
        if (removed > inserted) {
            typing.backspaces += removed - inserted;
        }
        typing.wordsTyped += estimateWords(change.text);
        // Heuristic error signal: frequent punctuation corrections and tiny undo-like edits.
        if ((removed > 0 && inserted > 0 && inserted <= 2) || /[;:,\.]{2,}/.test(change.text)) {
            typing.errorCount += 1;
        }
    }
    typing.durationMs = now - typing.startedAt;
}
async function flushTypingTelemetry() {
    const userId = getUserId();
    if (!userId || typing.durationMs < 3000) {
        return;
    }
    if (typing.charsTyped === 0 && typing.backspaces === 0) {
        return;
    }
    const payload = {
        userId,
        charsTyped: typing.charsTyped,
        wordsTyped: typing.wordsTyped,
        backspaces: typing.backspaces,
        errorCount: typing.errorCount,
        pauseMs: typing.pauseMs,
        durationMs: Math.max(typing.durationMs, 1000),
    };
    const response = await postJson("/api/v1/extension/events/typing", payload);
    if (!response.ok) {
        return;
    }
    const body = response.data;
    statusBar.text = `$(pulse) ThinkFlow: ${body.adaptiveMode} (${body.vibeScore})`;
    const mood = getMood(body.vibeScore);
    void sendTypingData(mood, body.vibeScore);
    void maybePromptBreak(mood);
    typing = resetAccumulator();
}
function getMood(score) {
    if (score < 40) {
        return "Frustrated";
    }
    if (score > 70) {
        return "Confident";
    }
    return "Neutral";
}
async function sendTypingData(mood, score) {
    const fallbackTargets = [
        "http://localhost:8000/typing",
        new URL("/api/v1/typing", getBackendUrl()).toString(),
    ];
    for (const target of fallbackTargets) {
        try {
            const response = await fetch(target, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mood, score }),
            });
            if (response.ok) {
                return;
            }
        }
        catch {
            // Try next target.
        }
    }
}
async function maybePromptBreak(mood) {
    if (mood !== "Frustrated") {
        return;
    }
    const selection = await vscode.window.showInformationMessage("You seem frustrated 😓", "Take Break");
    if (selection === "Take Break") {
        await vscode.env.openExternal(vscode.Uri.parse("http://localhost:5173/games"));
    }
}
async function pollCompanion() {
    const userId = getUserId();
    if (!userId) {
        return;
    }
    const response = await getJson(`/api/v1/companion/${userId}`);
    if (!response.ok) {
        return;
    }
    const body = response.data;
    if (body.adaptiveMode === "gentle") {
        void vscode.window.showInformationMessage(`ThinkFlow gentle mode: ${body.companionMessage} Suggested break: ${body.breakRecommendation.type} (${body.breakRecommendation.recommendedMinutes}m).`);
    }
}
function getUserId() {
    return vscode.workspace.getConfiguration("thinkflow").get("userId") ?? "";
}
function getBackendUrl() {
    return (vscode.workspace.getConfiguration("thinkflow").get("backendUrl") ??
        "http://localhost:8080");
}
function estimateWords(text) {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    return tokens.length;
}
function resetAccumulator() {
    const now = Date.now();
    return {
        charsTyped: 0,
        wordsTyped: 0,
        backspaces: 0,
        errorCount: 0,
        pauseMs: 0,
        durationMs: 0,
        lastEditAt: now,
        startedAt: now,
    };
}
async function postJson(path, payload) {
    return requestJson("POST", path, payload);
}
async function patchJson(path, payload) {
    return requestJson("PATCH", path, payload);
}
async function getJson(path) {
    return requestJson("GET", path);
}
async function requestJson(method, path, payload) {
    const baseUrl = getBackendUrl();
    const target = new URL(path, baseUrl);
    const body = payload ? JSON.stringify(payload) : undefined;
    const client = target.protocol === "https:" ? https : http;
    return new Promise((resolve) => {
        const req = client.request({
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port,
            path: `${target.pathname}${target.search}`,
            method,
            headers: {
                "content-type": "application/json",
                "content-length": body ? Buffer.byteLength(body) : 0,
            },
        }, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            res.on("end", () => {
                const text = Buffer.concat(chunks).toString("utf8");
                const parsed = tryParseJson(text);
                resolve({ ok: (res.statusCode ?? 500) < 400, data: parsed });
            });
        });
        req.on("error", () => resolve({ ok: false, data: {} }));
        if (body) {
            req.write(body);
        }
        req.end();
    });
}
function tryParseJson(text) {
    if (!text) {
        return {};
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return { raw: text };
    }
}
function getEmotionMonitorHtml(webview, backendApiFaceUrl) {
    const nonce = createNonce();
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; media-src ${webview.cspSource} blob:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' https:; connect-src https: http:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ThinkFlow Emotion Monitor</title>
    <style>
      body { font-family: Segoe UI, sans-serif; margin: 0; padding: 16px; background: #0f1116; color: #f2f4f8; }
      .card { border: 1px solid #30363d; border-radius: 12px; padding: 12px; background: #161b22; }
      .badge { display: inline-block; margin-top: 8px; padding: 6px 10px; border-radius: 999px; background: #232a33; }
      video { width: 100%; border-radius: 10px; background: #000; margin-top: 10px; }
      small { color: #9ba7b4; }
    </style>
  </head>
  <body>
    <div class="card">
      <h3>Webcam Face Emotion (IDE)</h3>
      <small>Runs every 2s and sends to http://localhost:8000/face</small>
      <div id="mood" class="badge">Current emotion: neutral</div>
      <video id="video" autoplay muted playsinline></video>
    </div>

    <script nonce="${nonce}" type="module">
      import * as faceapi from 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/+esm';

      const video = document.getElementById('video');
      const moodEl = document.getElementById('mood');
      let ready = false;

      function mapMood(expressions) {
        if (!expressions) return 'neutral';
        const ranked = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
        const top = ranked[0]?.[0] ?? 'neutral';
        if (top === 'happy') return 'happy';
        if (top === 'sad') return 'sad';
        if (top === 'angry' || top === 'disgusted') return 'angry';
        return 'neutral';
      }

      async function boot() {
        try {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models'),
            faceapi.nets.faceExpressionNet.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models')
          ]);
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          video.srcObject = stream;
          await video.play();
          ready = true;
        } catch {
          moodEl.textContent = 'Current emotion: webcam/model unavailable';
        }
      }

      async function tick() {
        if (!ready) return;
        try {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();

          const emotion = mapMood(detection?.expressions);
          moodEl.textContent = 'Current emotion: ' + emotion;

          const targets = [
            'http://localhost:8000/face',
            '${backendApiFaceUrl}'
          ];

          for (const target of targets) {
            try {
              const res = await fetch(target, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emotion })
              });
              if (res.ok) break;
            } catch {
              // Try next target.
            }
          }
        } catch {
          // Keep monitor resilient.
        }
      }

      await boot();
      setInterval(tick, 2000);
    </script>
  </body>
</html>`;
}
function createNonce() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < 16; i += 1) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}
//# sourceMappingURL=extension.js.map