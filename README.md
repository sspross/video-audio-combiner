# Video Audio Combiner

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
- FFmpeg (must be installed and available in PATH)
- uv (Python package manager)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH.

### Installing uv

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Installation

### Backend

```bash
cd backend
uv sync
```

### Frontend

```bash
cd frontend
npm install
```

## Running

### Development

Start both backend and frontend in separate terminals:

**Terminal 1 - Backend:**
```bash
cd backend && uv run uvicorn video_audio_combiner.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend && npm run dev
```

The Electron app will start and automatically connect to the backend.

## Usage

1. Select the main video file (the one you want to add audio to)
2. Select the secondary video file (the audio source)
3. Choose which audio tracks to use from each file
4. Click "Analyze & Detect Alignment" to auto-sync the audio
5. Adjust alignment manually if needed using the waveform viewer
6. Preview to verify the sync is correct
7. Export the merged video with the new audio track

## Tech Stack

- **Frontend:** Electron + React + TypeScript
- **Backend:** Python + FastAPI + librosa
- **Audio/Video Processing:** FFmpeg
