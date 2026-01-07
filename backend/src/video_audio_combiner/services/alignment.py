"""Alignment service for audio synchronization."""

import time
from pathlib import Path

import librosa
import numpy as np
from scipy import signal

from video_audio_combiner.api.schemas import (
    AlignResponse,
    AudioSegment,
    DriftDetectionResponse,
    DriftPoint,
)


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

    def detect_alignment(
        self, main_wav_path: str, secondary_wav_path: str
    ) -> AlignResponse:
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

    def detect_alignment_segment(
        self,
        main_wav_path: str,
        secondary_wav_path: str,
        start_time_ms: float,
        end_time_ms: float,
    ) -> AlignResponse:
        """Detect alignment offset for a specific time segment.

        Args:
            main_wav_path: Path to the main (reference) audio file.
            secondary_wav_path: Path to the secondary audio file to align.
            start_time_ms: Start time of the segment in milliseconds.
            end_time_ms: End time of the segment in milliseconds.

        Returns:
            AlignResponse with offset in milliseconds and confidence score.
        """
        main_path = Path(main_wav_path)
        secondary_path = Path(secondary_wav_path)

        if not main_path.exists():
            raise FileNotFoundError(f"Main audio file not found: {main_wav_path}")
        if not secondary_path.exists():
            raise FileNotFoundError(
                f"Secondary audio file not found: {secondary_wav_path}"
            )

        # Convert ms to seconds for librosa
        start_seconds = start_time_ms / 1000.0
        duration_seconds = (end_time_ms - start_time_ms) / 1000.0

        # Load audio segments
        y_main, _ = librosa.load(
            main_wav_path,
            sr=self.sample_rate,
            mono=True,
            offset=start_seconds,
            duration=duration_seconds,
        )
        y_secondary, _ = librosa.load(
            secondary_wav_path,
            sr=self.sample_rate,
            mono=True,
            offset=start_seconds,
            duration=duration_seconds,
        )

        # Handle case where audio is too short
        if len(y_main) < self.hop_length * 2 or len(y_secondary) < self.hop_length * 2:
            return AlignResponse(offset_ms=0.0, confidence=0.0)

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
        max_corr = np.max(correlation)
        mean_corr = np.mean(np.abs(correlation))
        confidence = min(1.0, max_corr / mean_corr / 10.0) if mean_corr > 0 else 0.0

        return AlignResponse(
            offset_ms=float(offset_ms),
            confidence=float(confidence),
        )

    def detect_drift_points(
        self,
        main_wav_path: str,
        secondary_wav_path: str,
        segment_duration_ms: int = 30000,
        step_ms: int = 15000,
        drift_threshold_ms: int = 500,
    ) -> DriftDetectionResponse:
        """Detect points where the alignment offset changes significantly.

        Scans the audio in sliding windows and detects where the offset
        changes by more than the threshold, indicating different cuts
        between the source videos.

        Args:
            main_wav_path: Path to the main (reference) audio file.
            secondary_wav_path: Path to the secondary audio file.
            segment_duration_ms: Duration of each analysis window in ms.
            step_ms: Step size between windows in ms.
            drift_threshold_ms: Minimum offset change to count as drift.

        Returns:
            DriftDetectionResponse with drift points and derived segments.
        """
        start_time = time.time()

        main_path = Path(main_wav_path)
        secondary_path = Path(secondary_wav_path)

        if not main_path.exists():
            raise FileNotFoundError(f"Main audio file not found: {main_wav_path}")
        if not secondary_path.exists():
            raise FileNotFoundError(
                f"Secondary audio file not found: {secondary_wav_path}"
            )

        # Get total duration of main audio
        main_duration_seconds = librosa.get_duration(path=main_wav_path)
        main_duration_ms = main_duration_seconds * 1000

        # Collect offset measurements at each position
        measurements: list[tuple[float, float, float]] = (
            []
        )  # (position_ms, offset_ms, confidence)

        position_ms = 0.0
        while position_ms + segment_duration_ms <= main_duration_ms:
            result = self.detect_alignment_segment(
                main_wav_path,
                secondary_wav_path,
                position_ms,
                position_ms + segment_duration_ms,
            )
            measurements.append((position_ms, result.offset_ms, result.confidence))
            position_ms += step_ms

        # If we couldn't get any measurements, return empty result
        if not measurements:
            return DriftDetectionResponse(
                drift_points=[],
                segments=[],
                scan_duration_seconds=time.time() - start_time,
            )

        # Detect drift points by finding where offset changes significantly
        drift_points: list[DriftPoint] = []

        for i in range(1, len(measurements)):
            prev_pos, prev_offset, prev_conf = measurements[i - 1]
            curr_pos, curr_offset, curr_conf = measurements[i]

            offset_change = abs(curr_offset - prev_offset)

            if offset_change >= drift_threshold_ms:
                # Calculate approximate drift position (midpoint between windows)
                drift_timestamp = (prev_pos + curr_pos + segment_duration_ms) / 2

                drift_points.append(
                    DriftPoint(
                        timestamp_ms=drift_timestamp,
                        offset_before_ms=prev_offset,
                        offset_after_ms=curr_offset,
                        confidence=min(prev_conf, curr_conf),
                    )
                )

        # Build segments from drift points
        segments: list[AudioSegment] = []

        if not drift_points:
            # No drift detected - single segment with global offset
            # Use median offset for robustness
            offsets = [m[1] for m in measurements]
            confidences = [m[2] for m in measurements]
            median_offset = float(np.median(offsets))
            avg_confidence = float(np.mean(confidences))

            segments.append(
                AudioSegment(
                    start_time_ms=0.0,
                    end_time_ms=main_duration_ms,
                    offset_ms=median_offset,
                    confidence=avg_confidence,
                )
            )
        else:
            # Build segments between drift points
            segment_start = 0.0

            for drift in drift_points:
                # Get measurements within this segment
                segment_measurements = [
                    m
                    for m in measurements
                    if segment_start <= m[0] < drift.timestamp_ms
                ]

                if segment_measurements:
                    offsets = [m[1] for m in segment_measurements]
                    confidences = [m[2] for m in segment_measurements]
                    segment_offset = float(np.median(offsets))
                    segment_confidence = float(np.mean(confidences))
                else:
                    segment_offset = drift.offset_before_ms
                    segment_confidence = drift.confidence

                segments.append(
                    AudioSegment(
                        start_time_ms=segment_start,
                        end_time_ms=drift.timestamp_ms,
                        offset_ms=segment_offset,
                        confidence=segment_confidence,
                    )
                )
                segment_start = drift.timestamp_ms

            # Add final segment after last drift point
            final_measurements = [
                m for m in measurements if m[0] >= drift_points[-1].timestamp_ms
            ]
            if final_measurements:
                offsets = [m[1] for m in final_measurements]
                confidences = [m[2] for m in final_measurements]
                final_offset = float(np.median(offsets))
                final_confidence = float(np.mean(confidences))
            else:
                final_offset = drift_points[-1].offset_after_ms
                final_confidence = drift_points[-1].confidence

            segments.append(
                AudioSegment(
                    start_time_ms=segment_start,
                    end_time_ms=main_duration_ms,
                    offset_ms=final_offset,
                    confidence=final_confidence,
                )
            )

        scan_duration = time.time() - start_time

        return DriftDetectionResponse(
            drift_points=drift_points,
            segments=segments,
            scan_duration_seconds=scan_duration,
        )
