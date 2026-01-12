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

https://github.com/user-attachments/assets/5b51eec3-4ed6-4e18-b92d-7df1246f4507

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

## Release Process

### Required GitHub Secrets


| Secret | Description |
|--------|-------------|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | Team ID from [developer.apple.com](https://developer.apple.com) |
| `CSC_LINK` | Base64-encoded .p12 certificate (To encode your certificate: `base64 -i certificate.p12 | pbcopy`) |
| `CSC_KEY_PASSWORD` | Certificate password |

### Creating a Release

1. **Bump version:**
   ```bash
   node scripts/bump-version.js patch  # or minor/major
   ```

2. **Update CHANGELOG.md** with release notes

3. **Commit and tag:**
   ```bash
   git add -A
   git commit -m "Release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```

4. GitHub Actions will automatically:
   - Build macOS DMG for ARM64 and Intel
   - Sign and notarize the app
   - Create a draft release with SHA256 checksums

5. Review the draft release on GitHub and publish
