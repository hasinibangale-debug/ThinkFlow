# ThinkFlow Backend

Backend service for circadian insights, emotion telemetry, adaptive companion responses, and IDE extension linking.

## Features Implemented

- Circadian Rhythm Tracking Dashboard API with productivity/fatigue graph output.
- Manual Mood & Energy entry with fusion against AI-derived typing emotion signal.
- Typing Speed & Emotion Tracking engine (vibe score + frustration/confidence detection).
- Companion adaptive mode suggestions (`gentle`, `balanced`, `challenge`) and break recommendation engine.
- Bot personality personalization (`strict-mentor`, `friendly-buddy`, `interviewer`).
- VS Code extension link endpoints and event ingestion endpoints.
- Gamified break quiz score and reward tracking.

## Run

```bash
cd backend
npm install
npm run dev
```

Server starts at `http://localhost:8080` by default.

## API Quick List

- `GET /api/v1/health`
- `POST /api/v1/users`
- `PATCH /api/v1/users/:userId/personality`
- `POST /api/v1/sleep`
- `POST /api/v1/moods/manual`
- `POST /api/v1/telemetry/typing`
- `POST /api/v1/sessions/start`
- `POST /api/v1/sessions/:sessionId/end`
- `GET /api/v1/dashboard/:userId`
- `GET /api/v1/companion/:userId`
- `POST /api/v1/extension/link`
- `POST /api/v1/extension/events/typing`
- `POST /api/v1/gamification/quiz-attempt`
- `GET /api/v1/gamification/:userId/score`

## Notes

- Data persists in `backend/data/thinkflow-db.json` using `lowdb`.
- The frontend has not been modified. Integration can be done later by pointing frontend data access to these APIs.
