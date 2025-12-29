# Video Audio Combiner

> **Disclaimer:** This is a 100% vibe coding experiment. From code, commits to the tutorial video.

Desktop tool to merge audio tracks from different video sources with automatic audio synchronization via waveform analysis.

```
┌──────────┐
│ Movie    │        ┌─────────────┐        ┌──────────┐
│ [EN] ~~~ │─┐      │  [EN] ~|~   │        │  Movie   │
└──────────┘ ├─────►│  [DE] ~|~   │───────►│ [EN] ~~~ │
┌──────────┐ │      │  ← ALIGN →  │        │ [DE] ~~~ │
│ Movie    │ │      └─────────────┘        └──────────┘
│ [DE] ~~~ │─┘
└──────────┘
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg
- uv

## Quick Start

```bash
make install   # Install all dependencies
make run       # Start the application
```

## Tech Stack

- **Frontend:** Electron + React + TypeScript
- **Backend:** Python + FastAPI + librosa
- **Audio/Video Processing:** FFmpeg
