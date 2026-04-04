import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/api.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    service: "ThinkFlow backend",
    version: "1.0.0",
    docs: "/api/v1/health",
  });
});

app.use("/api/v1", apiRouter);

app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : "Unknown server error";
    res.status(500).json({ error: message });
  }
);

// Render-compatible port handling
const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

app.listen(port, () => {
  console.log(`ThinkFlow backend running on port ${port}`);
});