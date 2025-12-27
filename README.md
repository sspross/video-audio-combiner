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

## Quick Start

```bash
make install   # Install all dependencies
make run       # Start the application
```

### All Available Commands

Run `make help` to see all available commands:

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies |
| `make run` / `make dev` | Start development |
| `make lint` | Run all linters |
| `make format` | Format all code |
| `make test` | Run all tests |
| `make frontend.install` | Install frontend dependencies |
| `make frontend.build` | Build for production |
| `make frontend.typecheck` | TypeScript type checking |
| `make backend.run` | Start backend standalone |
| `make clean` | Clean build artifacts |

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
