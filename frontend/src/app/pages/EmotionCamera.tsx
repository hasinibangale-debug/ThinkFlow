import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

type FaceMood = "happy" | "sad" | "angry" | "neutral";

const BRIDGE_BASE_URL = "http://localhost:8000";
const FACE_UPLOAD_ENDPOINTS = [
  `${BRIDGE_BASE_URL}/face`,
  "http://localhost:8080/api/v1/face",
];
const MODEL_SOURCES = [
  "/models",
  "https://justadudewhohacks.github.io/face-api.js/models",
];

function mapExpressionToMood(expressions?: faceapi.FaceExpressions): FaceMood {
  if (!expressions) {
    return "neutral";
  }

  const ranked = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
  const [label] = ranked[0] ?? ["neutral"];

  if (label === "happy") return "happy";
  if (label === "sad") return "sad";
  if (label === "angry" || label === "disgusted") return "angry";
  return "neutral";
}

export default function EmotionCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectInFlightRef = useRef(false);
  const [emotion, setEmotion] = useState<FaceMood>("neutral");
  const [ready, setReady] = useState(false);
  const [modelSource, setModelSource] = useState("");
  const [error, setError] = useState<string>("");

  const postEmotion = async (nextEmotion: FaceMood) => {
    for (const endpoint of FACE_UPLOAD_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emotion: nextEmotion }),
        });

        if (response.ok) {
          return;
        }
      } catch {
        // Try the next endpoint.
      }
    }
  };

  const loadModels = async () => {
    for (const source of MODEL_SOURCES) {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(source),
          faceapi.nets.faceExpressionNet.loadFromUri(source),
        ]);
        setModelSource(source);
        return;
      } catch {
        // Try next source.
      }
    }

    throw new Error("Unable to load face-api models from all configured sources.");
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadModels();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!cancelled) {
          setReady(true);
        }
      } catch {
        setError("Camera or face model initialization failed.");
      }
    }

    void init();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!ready || !videoRef.current) {
      return;
    }

    const interval = setInterval(async () => {
      if (detectInFlightRef.current) {
        return;
      }

      detectInFlightRef.current = true;
      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current!, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        const nextEmotion = mapExpressionToMood(detection?.expressions);
        setEmotion(nextEmotion);
        await postEmotion(nextEmotion);
      } catch {
        // Non-blocking fallback keeps the page responsive.
      } finally {
        detectInFlightRef.current = false;
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [ready]);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
      <h3 className="text-xl font-bold text-foreground mb-3">Emotion Camera</h3>
      <p className="text-sm text-muted-foreground mb-4">Webcam detection every 2 seconds.</p>

      {modelSource && (
        <div className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Face model source: {modelSource}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error} Add face-api models under public/models or ensure internet access for CDN fallback.
        </div>
      )}

      <div className="rounded-xl overflow-hidden bg-black/80 aspect-video mb-4">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
        Current emotion: <span className="text-primary uppercase">{emotion}</span>
      </div>
    </div>
  );
}
