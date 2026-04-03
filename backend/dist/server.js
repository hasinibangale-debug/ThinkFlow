import express from "express";
import cors from "cors";
import { config } from "./config.js";
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
app.use((err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : "Unknown server error";
    res.status(500).json({ error: message });
});
app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`ThinkFlow backend listening on http://localhost:${config.port}`);
});
