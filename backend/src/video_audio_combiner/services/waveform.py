"""Waveform generation service for audio visualization."""

from pathlib import Path

import librosa
import numpy as np

from video_audio_combiner.api.schemas import WaveformResponse


class WaveformService:
    """Service for generating waveform visualization data."""

    def generate_peaks(
        self, wav_path: str, samples_per_second: int = 100
    ) -> WaveformResponse:
        """Generate waveform peaks data for visualization.

        Generates a downsampled representation of the audio waveform
        suitable for rendering with wavesurfer.js.

        Args:
            wav_path: Path to the WAV file.
            samples_per_second: Number of peak samples per second of audio.

        Returns:
            WaveformResponse with peaks data.

        Raises:
            FileNotFoundError: If the file doesn't exist.
        """
        path = Path(wav_path)
        if not path.exists():
            raise FileNotFoundError(f"WAV file not found: {wav_path}")

        # Load audio file
        y, sr = librosa.load(wav_path, sr=None, mono=True)
        duration_seconds = len(y) / sr

        # Calculate samples needed
        total_samples = int(duration_seconds * samples_per_second)
        if total_samples == 0:
            return WaveformResponse(
                peaks=[],
                duration_seconds=duration_seconds,
                sample_rate=sr,
            )

        # Calculate samples per peak
        samples_per_peak = len(y) // total_samples

        peaks = []
        for i in range(total_samples):
            start = i * samples_per_peak
            end = min(start + samples_per_peak, len(y))
            chunk = y[start:end]

            if len(chunk) > 0:
                # Use max absolute value for peak
                peak = float(np.max(np.abs(chunk)))
                peaks.append(peak)

        # Normalize peaks to 0-1 range
        max_peak = max(peaks) if peaks else 1.0
        if max_peak > 0:
            peaks = [p / max_peak for p in peaks]

        return WaveformResponse(
            peaks=peaks,
            duration_seconds=duration_seconds,
            sample_rate=sr,
        )

    def generate_onset_envelope(self, wav_path: str) -> tuple[np.ndarray, int, float]:
        """Generate onset strength envelope for alignment.

        Args:
            wav_path: Path to the WAV file.

        Returns:
            Tuple of (onset_envelope, sample_rate, hop_length_seconds).

        Raises:
            FileNotFoundError: If the file doesn't exist.
        """
        path = Path(wav_path)
        if not path.exists():
            raise FileNotFoundError(f"WAV file not found: {wav_path}")

        # Load at 22050 Hz for analysis
        y, sr = librosa.load(wav_path, sr=22050, mono=True)

        # Compute onset strength envelope
        hop_length = 512
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)

        # Normalize
        if np.max(onset_env) > 0:
            onset_env = onset_env / np.max(onset_env)

        hop_length_seconds = hop_length / sr

        return onset_env, sr, hop_length_seconds
