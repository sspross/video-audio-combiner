"""Alignment service for audio synchronization."""

from pathlib import Path

import librosa
import numpy as np
from scipy import signal

from video_audio_combiner.api.schemas import AlignResponse


class AlignmentService:
    """Service for detecting audio alignment offset."""

    def __init__(self, sample_rate: int = 22050, hop_length: int = 512):
        """Initialize alignment service.

        Args:
            sample_rate: Sample rate for audio analysis.
            hop_length: Hop length for onset detection.
        """
        self.sample_rate = sample_rate
        self.hop_length = hop_length

    def detect_alignment(self, main_wav_path: str, secondary_wav_path: str) -> AlignResponse:
        """Detect the alignment offset between two audio files.

        Uses onset strength envelopes and cross-correlation to find
        the best alignment offset between the main and secondary audio.

        Args:
            main_wav_path: Path to the main (reference) audio file.
            secondary_wav_path: Path to the secondary audio file to align.

        Returns:
            AlignResponse with offset in milliseconds and confidence score.

        Raises:
            FileNotFoundError: If either file doesn't exist.
        """
        main_path = Path(main_wav_path)
        secondary_path = Path(secondary_wav_path)

        if not main_path.exists():
            raise FileNotFoundError(f"Main audio file not found: {main_wav_path}")
        if not secondary_path.exists():
            raise FileNotFoundError(f"Secondary audio file not found: {secondary_wav_path}")

        # Load audio files
        y_main, _ = librosa.load(main_wav_path, sr=self.sample_rate, mono=True)
        y_secondary, _ = librosa.load(secondary_wav_path, sr=self.sample_rate, mono=True)

        # Compute onset strength envelopes
        onset_main = librosa.onset.onset_strength(
            y=y_main, sr=self.sample_rate, hop_length=self.hop_length
        )
        onset_secondary = librosa.onset.onset_strength(
            y=y_secondary, sr=self.sample_rate, hop_length=self.hop_length
        )

        # Normalize envelopes
        if np.max(onset_main) > 0:
            onset_main = onset_main / np.max(onset_main)
        if np.max(onset_secondary) > 0:
            onset_secondary = onset_secondary / np.max(onset_secondary)

        # Cross-correlation to find best alignment
        correlation = signal.correlate(onset_main, onset_secondary, mode="full")
        lag_samples = np.argmax(correlation) - len(onset_secondary) + 1

        # Convert lag from frames to milliseconds
        frame_duration_seconds = self.hop_length / self.sample_rate
        offset_seconds = lag_samples * frame_duration_seconds
        offset_ms = offset_seconds * 1000

        # Calculate confidence score
        # Higher correlation peak relative to mean indicates better match
        max_corr = np.max(correlation)
        mean_corr = np.mean(np.abs(correlation))
        confidence = min(1.0, max_corr / mean_corr / 10.0) if mean_corr > 0 else 0.0

        return AlignResponse(
            offset_ms=float(offset_ms),
            confidence=float(confidence),
        )

    def compute_correlation_curve(
        self, main_wav_path: str, secondary_wav_path: str
    ) -> tuple[np.ndarray, np.ndarray]:
        """Compute the full correlation curve for visualization.

        Args:
            main_wav_path: Path to the main audio file.
            secondary_wav_path: Path to the secondary audio file.

        Returns:
            Tuple of (lag_values_ms, correlation_values).
        """
        main_path = Path(main_wav_path)
        secondary_path = Path(secondary_wav_path)

        if not main_path.exists():
            raise FileNotFoundError(f"Main audio file not found: {main_wav_path}")
        if not secondary_path.exists():
            raise FileNotFoundError(f"Secondary audio file not found: {secondary_wav_path}")

        # Load audio files
        y_main, _ = librosa.load(main_wav_path, sr=self.sample_rate, mono=True)
        y_secondary, _ = librosa.load(secondary_wav_path, sr=self.sample_rate, mono=True)

        # Compute onset strength envelopes
        onset_main = librosa.onset.onset_strength(
            y=y_main, sr=self.sample_rate, hop_length=self.hop_length
        )
        onset_secondary = librosa.onset.onset_strength(
            y=y_secondary, sr=self.sample_rate, hop_length=self.hop_length
        )

        # Normalize
        if np.max(onset_main) > 0:
            onset_main = onset_main / np.max(onset_main)
        if np.max(onset_secondary) > 0:
            onset_secondary = onset_secondary / np.max(onset_secondary)

        # Cross-correlation
        correlation = signal.correlate(onset_main, onset_secondary, mode="full")

        # Normalize correlation
        correlation = correlation / np.max(np.abs(correlation))

        # Compute lag values in milliseconds
        frame_duration_ms = (self.hop_length / self.sample_rate) * 1000
        lags = np.arange(-(len(onset_secondary) - 1), len(onset_main))
        lags_ms = lags * frame_duration_ms

        return lags_ms, correlation
