"""FFmpeg service for video/audio operations."""

import json
import subprocess
import tempfile
from pathlib import Path

from video_audio_combiner.api.schemas import (
    AudioSegment,
    AudioTrack,
    CompensateResponse,
    ExtractResponse,
    FrameResponse,
    MergeResponse,
    PreviewResponse,
    TracksResponse,
)


class FFmpegService:
    """Service for FFmpeg operations."""

    def __init__(self, temp_dir: Path | None = None):
        """Initialize FFmpeg service.

        Args:
            temp_dir: Directory for temporary files. Uses system temp if None.
        """
        self.temp_dir = temp_dir or Path(tempfile.gettempdir()) / "video-audio-combiner"
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def _run_ffprobe(self, file_path: str) -> dict:
        """Run ffprobe and return JSON output.

        Args:
            file_path: Path to the video file.

        Returns:
            Parsed JSON output from ffprobe.

        Raises:
            FileNotFoundError: If the file doesn't exist.
            ValueError: If ffprobe fails.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        cmd = [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return json.loads(result.stdout)
        except subprocess.CalledProcessError as e:
            raise ValueError(f"ffprobe failed: {e.stderr}") from e
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse ffprobe output: {e}") from e

    def get_audio_tracks(self, file_path: str) -> TracksResponse:
        """Get audio tracks from a video file.

        Args:
            file_path: Path to the video file.

        Returns:
            TracksResponse with audio track information.
        """
        probe_data = self._run_ffprobe(file_path)

        # Get file duration
        duration_seconds = float(probe_data.get("format", {}).get("duration", 0))

        # Extract audio streams
        audio_streams = [
            s for s in probe_data.get("streams", []) if s.get("codec_type") == "audio"
        ]

        tracks = []
        for i, stream in enumerate(audio_streams):
            tags = stream.get("tags", {})
            track = AudioTrack(
                index=i,
                codec=stream.get("codec_name", "unknown"),
                language=tags.get("language"),
                title=tags.get("title"),
                channels=stream.get("channels", 2),
                sample_rate=int(stream.get("sample_rate", 44100)),
                duration_seconds=float(stream.get("duration", duration_seconds)),
            )
            tracks.append(track)

        return TracksResponse(
            file_path=file_path,
            duration_seconds=duration_seconds,
            tracks=tracks,
        )

    def extract_audio(self, file_path: str, track_index: int) -> ExtractResponse:
        """Extract an audio track to WAV format.

        Args:
            file_path: Path to the video file.
            track_index: Index of the audio track to extract.

        Returns:
            ExtractResponse with path to extracted WAV file.

        Raises:
            FileNotFoundError: If the file doesn't exist.
            ValueError: If the track index is invalid or extraction fails.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Get tracks to validate index
        tracks_response = self.get_audio_tracks(file_path)
        if track_index < 0 or track_index >= len(tracks_response.tracks):
            raise ValueError(
                f"Invalid track index {track_index}. "
                f"File has {len(tracks_response.tracks)} audio tracks."
            )

        # Generate output path
        output_path = self.temp_dir / f"{path.stem}_track{track_index}.wav"

        # Extract audio
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output
            "-i",
            str(path),
            "-map",
            f"0:a:{track_index}",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "22050",  # 22050 Hz for analysis (good balance)
            "-ac",
            "1",  # Mono for analysis
            str(output_path),
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            raise ValueError(f"FFmpeg extraction failed: {e.stderr}") from e

        # Get duration of extracted audio
        probe_data = self._run_ffprobe(str(output_path))
        duration_seconds = float(probe_data.get("format", {}).get("duration", 0))

        return ExtractResponse(
            wav_path=str(output_path),
            duration_seconds=duration_seconds,
        )

    def merge_audio(
        self,
        video_path: str,
        audio_path: str,
        offset_ms: float,
        output_path: str,
        language: str = "und",
        title: str | None = None,
        modify_original: bool = False,
    ) -> MergeResponse:
        """Merge an audio track into a video file.

        Args:
            video_path: Path to the original video file.
            audio_path: Path to the audio file to add.
            offset_ms: Offset in milliseconds for the audio.
            output_path: Path for the output file.
            language: Language code for the audio track.
            title: Title for the audio track.
            modify_original: If True, modify the original file in place.

        Returns:
            MergeResponse with result information.
        """
        import shutil

        video = Path(video_path)
        audio = Path(audio_path)

        if not video.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")
        if not audio.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Convert offset to seconds
        offset_seconds = offset_ms / 1000.0

        # Get the index for the new audio track
        new_track_index = self._count_audio_tracks(video_path)

        # Determine actual output path (use temp file if modifying original)
        if modify_original:
            actual_output = self.temp_dir / f"merge_temp{video.suffix}"
            final_output = video_path
        else:
            actual_output = Path(output_path)
            final_output = output_path

        # Build FFmpeg command
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output
            "-i",
            str(video),
            "-itsoffset",
            str(offset_seconds),
            "-i",
            str(audio),
            "-map",
            "0",  # All streams from original video
            "-map",
            "1:a",  # Audio from second input
            "-c",
            "copy",  # Copy all streams
            f"-c:a:{new_track_index}",
            "aac",  # Encode new audio as AAC
            f"-metadata:s:a:{new_track_index}",
            f"language={language}",
        ]

        # Add title metadata if provided
        if title:
            cmd.extend(
                [
                    f"-metadata:s:a:{new_track_index}",
                    f"title={title}",
                ]
            )

        cmd.append(str(actual_output))

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)

            # If modifying original, replace the original file with the temp file
            if modify_original:
                shutil.move(str(actual_output), final_output)

            return MergeResponse(output_path=final_output, success=True)
        except subprocess.CalledProcessError as e:
            # Clean up temp file if it exists
            if modify_original and actual_output.exists():
                actual_output.unlink()
            raise ValueError(f"FFmpeg merge failed: {e.stderr}") from e

    def _count_audio_tracks(self, file_path: str) -> int:
        """Count the number of audio tracks in a video file."""
        tracks_response = self.get_audio_tracks(file_path)
        return len(tracks_response.tracks)

    def generate_preview(
        self,
        video_path: str,
        audio_path: str,
        start_time_seconds: float,
        duration_seconds: float,
        offset_ms: float,
        mute_main_audio: bool = True,
        mute_secondary_audio: bool = False,
    ) -> PreviewResponse:
        """Generate a preview clip with combined audio.

        Args:
            video_path: Path to the original video file.
            audio_path: Path to the new audio file (WAV).
            start_time_seconds: Start time in the main video timeline.
            duration_seconds: Duration of the preview clip.
            offset_ms: Audio offset in milliseconds.
            mute_main_audio: If True, mute the original video's audio.
            mute_secondary_audio: If True, mute the secondary audio.

        Returns:
            PreviewResponse with path to the preview file.
        """
        video = Path(video_path)
        audio = Path(audio_path)

        if not video.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")
        if not audio.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Generate output path
        output_path = self.temp_dir / "preview.mp4"

        # Convert offset to seconds
        offset_seconds = offset_ms / 1000.0

        # Calculate the audio start time (accounting for offset)
        # If offset is positive, audio starts later in the video timeline
        # So for the same video position, we need audio from an earlier point
        audio_start_time = start_time_seconds - offset_seconds

        # Build FFmpeg command based on mute settings
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output
            "-ss", str(max(0, start_time_seconds)),  # Seek in video
            "-i", str(video),
            "-ss", str(max(0, audio_start_time)),  # Seek in audio
            "-i", str(audio),
            "-t", str(duration_seconds),  # Duration
            "-map", "0:v:0",  # Video from first input
        ]

        # Handle audio mapping based on mute settings
        if mute_main_audio and mute_secondary_audio:
            # Both muted - no audio
            cmd.extend(["-an"])
        elif mute_main_audio and not mute_secondary_audio:
            # Only secondary audio (current default behavior)
            cmd.extend(["-map", "1:a:0"])
        elif not mute_main_audio and mute_secondary_audio:
            # Only main audio
            cmd.extend(["-map", "0:a:0"])
        else:
            # Both audios - mix them together
            cmd.extend([
                "-filter_complex", "[0:a:0][1:a:0]amix=inputs=2:duration=first[aout]",
                "-map", "[aout]",
            ])

        # Video encoding settings
        cmd.extend([
            "-c:v", "libx264",  # Re-encode video (needed for accurate seeking)
            "-preset", "ultrafast",  # Fast encoding for preview
            "-crf", "28",  # Lower quality for smaller file
        ])

        # Audio encoding (if any audio is present)
        if not (mute_main_audio and mute_secondary_audio):
            cmd.extend([
                "-c:a", "aac",
                "-b:a", "128k",
            ])

        cmd.extend([
            "-movflags", "+faststart",  # Enable streaming
            str(output_path),
        ])

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            raise ValueError(f"FFmpeg preview generation failed: {e.stderr}") from e

        return PreviewResponse(
            preview_path=str(output_path),
            duration_seconds=duration_seconds,
        )

    def extract_frame(self, video_path: str, time_seconds: float) -> FrameResponse:
        """Extract a single frame from video at the specified time.

        Args:
            video_path: Path to the video file.
            time_seconds: Time position in seconds.

        Returns:
            FrameResponse with path to the extracted frame image.

        Raises:
            FileNotFoundError: If the video file doesn't exist.
            ValueError: If frame extraction fails.
        """
        video = Path(video_path)
        if not video.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # Generate output path with timestamp to allow caching
        # Use a hash of path + time to create unique filename
        import hashlib

        path_hash = hashlib.md5(f"{video_path}:{time_seconds}".encode()).hexdigest()[:12]
        output_path = self.temp_dir / f"frame_{path_hash}.jpg"

        # If frame already exists, return it (caching)
        if output_path.exists():
            return FrameResponse(frame_path=str(output_path), time_seconds=time_seconds)

        # Extract frame using FFmpeg
        # Use -ss before -i for fast seeking
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output
            "-ss",
            str(max(0, time_seconds)),  # Seek to position
            "-i",
            str(video),
            "-vframes",
            "1",  # Extract only one frame
            "-q:v",
            "2",  # High quality JPEG (1-31, lower is better)
            str(output_path),
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            raise ValueError(f"FFmpeg frame extraction failed: {e.stderr}") from e

        return FrameResponse(frame_path=str(output_path), time_seconds=time_seconds)

    def compensate_audio(
        self,
        audio_path: str,
        segments: list[AudioSegment],
        crossfade_ms: int = 50,
    ) -> CompensateResponse:
        """Compensate audio for multi-segment alignment.

        Inserts silence or trims audio at segment boundaries to maintain
        sync when source videos have different cuts.

        The compensation works by calculating the offset difference between
        consecutive segments. If segment N+1 has a larger negative offset
        than segment N, it means the secondary audio needs to be lengthened
        (silence inserted). If smaller, audio needs to be trimmed.

        Args:
            audio_path: Path to the audio file to compensate.
            segments: List of segments with their individual offsets.
            crossfade_ms: Duration of crossfade at segment boundaries.

        Returns:
            CompensateResponse with path to compensated audio and stats.
        """
        audio = Path(audio_path)
        if not audio.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        if len(segments) < 2:
            # No compensation needed for single segment
            return CompensateResponse(
                compensated_path=audio_path,
                total_silence_inserted_ms=0.0,
                total_trimmed_ms=0.0,
            )

        # Sort segments by start time
        sorted_segments = sorted(segments, key=lambda s: s.start_time_ms)

        # Calculate adjustments needed at each boundary
        # adjustment = offset_after - offset_before
        # positive = insert silence, negative = trim
        adjustments: list[tuple[float, float]] = []  # (timestamp_ms, adjustment_ms)
        total_silence_ms = 0.0
        total_trimmed_ms = 0.0

        for i in range(1, len(sorted_segments)):
            prev_segment = sorted_segments[i - 1]
            curr_segment = sorted_segments[i]

            # The boundary is at curr_segment.start_time_ms
            boundary_ms = curr_segment.start_time_ms

            # Calculate adjustment needed
            # If curr offset is more negative, we need to insert silence
            # (the secondary audio is shorter than expected)
            adjustment_ms = prev_segment.offset_ms - curr_segment.offset_ms

            if abs(adjustment_ms) > 0:
                adjustments.append((boundary_ms, adjustment_ms))
                if adjustment_ms > 0:
                    total_silence_ms += adjustment_ms
                else:
                    total_trimmed_ms += abs(adjustment_ms)

        if not adjustments:
            # No actual adjustments needed
            return CompensateResponse(
                compensated_path=audio_path,
                total_silence_inserted_ms=0.0,
                total_trimmed_ms=0.0,
            )

        # Generate output path
        output_path = self.temp_dir / f"compensated_{audio.stem}.wav"

        # Build FFmpeg filter complex for segment processing
        # We'll split the audio at boundaries and apply delays/trims
        filter_parts = []
        concat_inputs = []

        # Track cumulative adjustment for position calculations
        cumulative_adjustment_ms = 0.0

        for i, (boundary_ms, adjustment_ms) in enumerate(adjustments):
            # Calculate the actual position in the source audio
            # (accounting for previous adjustments)
            source_pos_ms = boundary_ms - cumulative_adjustment_ms

            if i == 0:
                # First segment: from start to first boundary
                start_ms = 0
            else:
                # Start from previous boundary
                prev_boundary_ms = adjustments[i - 1][0]
                prev_adjustment_ms = adjustments[i - 1][1]
                start_ms = prev_boundary_ms - (
                    cumulative_adjustment_ms - prev_adjustment_ms
                )
                if prev_adjustment_ms < 0:
                    # Previous was a trim, skip that portion
                    start_ms += abs(prev_adjustment_ms)

            end_ms = source_pos_ms

            # Add segment filter
            segment_label = f"seg{i}"
            filter_parts.append(
                f"[0:a]atrim=start_sample=0:start={start_ms/1000}:end={end_ms/1000},"
                f"asetpts=PTS-STARTPTS[{segment_label}]"
            )
            concat_inputs.append(f"[{segment_label}]")

            if adjustment_ms > 0:
                # Insert silence
                silence_label = f"sil{i}"
                silence_duration = adjustment_ms / 1000.0
                filter_parts.append(
                    f"aevalsrc=0:d={silence_duration}:s=22050:c=mono[{silence_label}]"
                )
                concat_inputs.append(f"[{silence_label}]")
            # For negative adjustment (trim), we skip audio by adjusting the next start

            cumulative_adjustment_ms += adjustment_ms

        # Add final segment (from last boundary to end)
        last_boundary_ms = adjustments[-1][0]
        last_adjustment_ms = adjustments[-1][1]
        final_start_ms = last_boundary_ms - (
            cumulative_adjustment_ms - last_adjustment_ms
        )
        if last_adjustment_ms < 0:
            final_start_ms += abs(last_adjustment_ms)

        final_label = "segfinal"
        filter_parts.append(
            f"[0:a]atrim=start={final_start_ms/1000},asetpts=PTS-STARTPTS[{final_label}]"
        )
        concat_inputs.append(f"[{final_label}]")

        # Build concat filter
        concat_filter = "".join(concat_inputs) + f"concat=n={len(concat_inputs)}:v=0:a=1[out]"
        filter_parts.append(concat_filter)

        filter_complex = ";".join(filter_parts)

        # Build FFmpeg command
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(audio),
            "-filter_complex",
            filter_complex,
            "-map",
            "[out]",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "22050",
            "-ac",
            "1",
            str(output_path),
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            # If complex filter fails, try simpler approach
            # Just copy with initial offset and let some parts be out of sync
            raise ValueError(
                f"FFmpeg audio compensation failed: {e.stderr}. "
                "The segment boundaries may be too complex to process."
            ) from e

        return CompensateResponse(
            compensated_path=str(output_path),
            total_silence_inserted_ms=total_silence_ms,
            total_trimmed_ms=total_trimmed_ms,
        )

    def cleanup_temp_files(self) -> None:
        """Remove all temporary files created by this service."""
        if self.temp_dir.exists():
            for file in self.temp_dir.glob("*.wav"):
                file.unlink()
            for file in self.temp_dir.glob("*.mp4"):
                file.unlink()
            for file in self.temp_dir.glob("*.jpg"):
                file.unlink()
