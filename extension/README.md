# ThinkFlow VS Code Link

This extension streams typing telemetry to the ThinkFlow backend and surfaces adaptive mood-aware companion guidance in VS Code.

## Setup

1. Run backend at `http://localhost:8080`.
2. Install extension dependencies and build:

```bash
cd extension
npm install
npm run build
```

3. Press `F5` in VS Code Extension Development Host.
4. Run command `ThinkFlow: Link Account`.

## Commands

- `ThinkFlow: Link Account`
- `ThinkFlow: Start Session`
- `ThinkFlow: End Session`
- `ThinkFlow: Set Personality Mode`
