# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desktop application for merging audio tracks from different video sources with automatic audio synchronization via waveform analysis. Uses onset strength envelopes and cross-correlation to detect alignment offsets between audio tracks.

## Tech Stack

- **Frontend:** Electron + React + TypeScript + Zustand (state management)
- **Backend:** Python + FastAPI + librosa (audio analysis)
- **Build Tools:** electron-vite (frontend), uv (Python package manager)
- **Audio/Video Processing:** FFmpeg (must be installed and in PATH)

## Development Commands

### Backend

```bash
cd backend
uv sync                                                    # Install dependencies
uv run uvicorn video_audio_combiner.main:app --reload --port 8000  # Start dev server
uv run ruff check src                                      # Lint
uv run ruff format src                                     # Format
uv run pytest                                              # Run tests
uv run pytest tests/test_specific.py::test_name -v        # Run single test
```

### Frontend

```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start Electron in dev mode (auto-starts backend on port 8765)
npm run build                  # Build for production
npm run lint                   # ESLint
npm run typecheck              # TypeScript check
```

## Architecture

### Communication Flow

```
Electron Renderer (React)
    ↓ (axios HTTP)
Python Backend (FastAPI on port 8765)
    ↓ (subprocess)
FFmpeg / librosa
```

The Electron main process spawns the Python backend automatically during development using `uv run`. The frontend polls `/api/health` until the backend is ready.

### Backend Structure (`backend/src/video_audio_combiner/`)

- `main.py` - FastAPI app entry point, CORS config
- `api/routes.py` - All REST endpoints (`/api/analyze/*`, `/api/align/*`, `/api/merge`, `/api/preview`)
- `api/schemas.py` - Pydantic request/response models
- `services/ffmpeg_service.py` - FFmpeg wrapper for extraction, merging, preview generation
- `services/alignment.py` - Audio sync detection using librosa onset strength + scipy cross-correlation
- `services/waveform.py` - Waveform peak generation for UI visualization

### Frontend Structure (`frontend/src/`)

- `main/index.ts` - Electron main process, IPC handlers, window management
- `main/python-backend.ts` - Python backend process manager
- `renderer/src/App.tsx` - Main React component, workflow orchestration
- `renderer/src/stores/projectStore.ts` - Zustand store for all application state
- `renderer/src/hooks/useBackendApi.ts` - API client wrapper with all backend calls

### Key Data Flow

1. User selects two video files → `getAudioTracks()` extracts track metadata via ffprobe
2. "Analyze" → `extractAudio()` creates mono WAV files, `generateWaveform()` creates peak data for visualization
3. Auto-alignment → `detectAlignment()` uses librosa onset detection + cross-correlation to find offset
4. Preview → `generatePreview()` creates short clip with aligned audio for verification
5. Export → `mergeAudio()` adds the new audio track to the original video with proper offset

### Custom Protocol

`local-video://` protocol registered in Electron for secure local file streaming in the renderer.

## API Endpoints

All endpoints prefixed with `/api`:

- `GET /health` - Backend health check
- `POST /analyze/tracks?file_path=...` - Get audio tracks from video
- `POST /analyze/extract` - Extract audio track to WAV
- `POST /analyze/waveform` - Generate waveform peaks
- `POST /align/detect` - Detect alignment offset between two audio files
- `POST /merge` - Merge audio into video with offset
- `POST /preview` - Generate preview clip

## Important Notes

- Backend uses lazy imports for librosa to reduce startup time
- Temporary files stored in system temp dir under `video-audio-combiner/`
- Audio extracted at 22050 Hz mono for analysis (balance of quality vs speed)
- Preview encoding uses `ultrafast` preset for quick generation
