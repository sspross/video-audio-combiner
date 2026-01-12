"""FFmpeg service for video/audio operations."""

import json
import subprocess
import tempfile
from pathlib import Path

from video_audio_combiner.api.schemas import (
    AudioTrack,
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

    def _parse_framerate(self, framerate_str: str) -> float | None:
        """Parse framerate string (e.g., '24000/1001') to float.

        Args:
            framerate_str: Framerate as string, either fraction or decimal.

        Returns:
            Framerate as float, or None if parsing fails.
        """
        if not framerate_str or framerate_str == "0/0":
            return None
        try:
            if "/" in framerate_str:
                num, denom = framerate_str.split("/")
                if float(denom) == 0:
                    return None
                return float(num) / float(denom)
            return float(framerate_str)
        except (ValueError, ZeroDivisionError):
            return None

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

        # Extract video framerate from first video stream
        video_framerate = None
        video_streams = [s for s in probe_data.get("streams", []) if s.get("codec_type") == "video"]
        if video_streams:
            # Prefer r_frame_rate (real framerate), fall back to avg_frame_rate
            video_stream = video_streams[0]
            framerate_str = video_stream.get("r_frame_rate") or video_stream.get("avg_frame_rate")
            if framerate_str:
                video_framerate = self._parse_framerate(framerate_str)

        # Extract audio streams
        audio_streams = [s for s in probe_data.get("streams", []) if s.get("codec_type") == "audio"]

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
            video_framerate=video_framerate,
        )

    def extract_audio(
        self,
        file_path: str,
        track_index: int,
        target_framerate: float | None = None,
    ) -> ExtractResponse:
        """Extract an audio track to WAV format, optionally stretching for framerate.

        Args:
            file_path: Path to the video file.
            track_index: Index of the audio track to extract.
            target_framerate: If provided, stretch audio to match this framerate.

        Returns:
            ExtractResponse with path to extracted WAV file.

        Raises:
            FileNotFoundError: If the file doesn't exist.
            ValueError: If the track index is invalid or extraction fails.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Get tracks to validate index and get source framerate
        tracks_response = self.get_audio_tracks(file_path)
        if track_index < 0 or track_index >= len(tracks_response.tracks):
            raise ValueError(
                f"Invalid track index {track_index}. "
                f"File has {len(tracks_response.tracks)} audio tracks."
            )

        source_framerate = tracks_response.video_framerate

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

        # Calculate tempo ratio and stretch if needed
        tempo_ratio = None
        stretched = False

        if (
            target_framerate is not None
            and source_framerate is not None
            and abs(source_framerate - target_framerate) > 0.01
        ):
            # Calculate tempo ratio: source_fps / target_fps
            # If source is 25fps and target is 23.976fps, ratio is ~1.0427
            # Audio needs to be slowed by 1/ratio to match target timing
            tempo_ratio = source_framerate / target_framerate

            # Stretch the audio
            stretched_path = self.temp_dir / f"{path.stem}_track{track_index}_stretched.wav"
            self.stretch_audio(output_path, stretched_path, tempo_ratio)

            # Replace original with stretched version
            output_path.unlink()
            stretched_path.rename(output_path)
            stretched = True

        # Get duration of final audio
        probe_data = self._run_ffprobe(str(output_path))
        duration_seconds = float(probe_data.get("format", {}).get("duration", 0))

        return ExtractResponse(
            wav_path=str(output_path),
            duration_seconds=duration_seconds,
            source_framerate=source_framerate,
            tempo_ratio=tempo_ratio,
            stretched=stretched,
        )

    def stretch_audio(self, input_path: Path, output_path: Path, tempo_ratio: float) -> None:
        """Stretch audio by tempo ratio using FFmpeg atempo filter.

        Args:
            input_path: Path to the input WAV file.
            output_path: Path for the output stretched WAV file.
            tempo_ratio: Ratio to stretch by (>1 speeds up, <1 slows down).
                        Audio needs to be stretched by 1/tempo_ratio to match.

        Raises:
            ValueError: If stretching fails.
        """
        # We need to apply 1/tempo_ratio to slow down audio to match target
        # atempo filter: >1 speeds up, <1 slows down
        atempo_value = 1.0 / tempo_ratio

        # atempo only supports 0.5-2.0, chain filters for extreme values
        filters = []
        remaining = atempo_value
        while remaining < 0.5 or remaining > 2.0:
            if remaining < 0.5:
                filters.append("atempo=0.5")
                remaining = remaining / 0.5
            else:
                filters.append("atempo=2.0")
                remaining = remaining / 2.0
        filters.append(f"atempo={remaining:.6f}")

        filter_str = ",".join(filters)
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-filter:a",
            filter_str,
            "-acodec",
            "pcm_s16le",
            str(output_path),
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            raise ValueError(f"FFmpeg audio stretching failed: {e.stderr}") from e

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
        secondary_video_path: str | None = None,
    ) -> PreviewResponse:
        """Generate a preview clip with combined audio.

        If secondary_video_path is provided, generates a side-by-side composite
        with main video on the left and secondary on the right.

        Args:
            video_path: Path to the original video file.
            audio_path: Path to the new audio file (WAV).
            start_time_seconds: Start time in the main video timeline.
            duration_seconds: Duration of the preview clip.
            offset_ms: Audio offset in milliseconds.
            mute_main_audio: If True, mute the original video's audio.
            mute_secondary_audio: If True, mute the secondary audio.
            secondary_video_path: Optional path to secondary video for side-by-side.

        Returns:
            PreviewResponse with path to the preview file.
        """
        video = Path(video_path)
        audio = Path(audio_path)

        if not video.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")
        if not audio.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        if secondary_video_path:
            secondary_video = Path(secondary_video_path)
            if not secondary_video.exists():
                raise FileNotFoundError(f"Secondary video file not found: {secondary_video_path}")

        # Generate output path
        output_path = self.temp_dir / "preview.mp4"

        # Convert offset to seconds
        offset_seconds = offset_ms / 1000.0

        # Calculate the audio/secondary video start time (accounting for offset)
        # If offset is positive, audio starts later in the video timeline
        # So for the same video position, we need audio from an earlier point
        secondary_start_time = start_time_seconds - offset_seconds

        if secondary_video_path:
            # Side-by-side video preview
            cmd = [
                "ffmpeg",
                "-y",  # Overwrite output
                "-hide_banner",  # Reduce noise in output
                "-loglevel",
                "error",  # Only show errors, not warnings
                "-ss",
                str(max(0, start_time_seconds)),  # Seek main video
                "-i",
                str(video),
                "-ss",
                str(max(0, secondary_start_time)),  # Seek secondary video
                "-i",
                str(secondary_video_path),
                "-ss",
                str(max(0, secondary_start_time)),  # Seek audio
                "-i",
                str(audio),
                "-t",
                str(duration_seconds),  # Duration
            ]

            # Build filter complex for side-by-side video
            # Scale both videos to same height then stack horizontally
            # Use -2 to ensure even dimensions (required by most codecs)
            # Add format=yuv420p for libx264 compatibility
            video_filter = (
                "[0:v]scale=-2:720,format=yuv420p[left];"
                "[1:v]scale=-2:720,format=yuv420p[right];"
                "[left][right]hstack=inputs=2[vout]"
            )

            # Handle audio based on mute settings
            if mute_main_audio and mute_secondary_audio:
                # Both muted - no audio
                cmd.extend(
                    [
                        "-filter_complex",
                        video_filter,
                        "-map",
                        "[vout]",
                        "-an",
                    ]
                )
            elif mute_main_audio and not mute_secondary_audio:
                # Only secondary audio
                cmd.extend(
                    [
                        "-filter_complex",
                        video_filter,
                        "-map",
                        "[vout]",
                        "-map",
                        "2:a:0",
                    ]
                )
            elif not mute_main_audio and mute_secondary_audio:
                # Only main audio
                cmd.extend(
                    [
                        "-filter_complex",
                        video_filter,
                        "-map",
                        "[vout]",
                        "-map",
                        "0:a:0",
                    ]
                )
            else:
                # Both audios - mix them together
                full_filter = f"{video_filter};[0:a:0][2:a:0]amix=inputs=2:duration=first[aout]"
                cmd.extend(
                    [
                        "-filter_complex",
                        full_filter,
                        "-map",
                        "[vout]",
                        "-map",
                        "[aout]",
                    ]
                )
        else:
            # Single video preview (original behavior)
            cmd = [
                "ffmpeg",
                "-y",  # Overwrite output
                "-ss",
                str(max(0, start_time_seconds)),  # Seek in video
                "-i",
                str(video),
                "-ss",
                str(max(0, secondary_start_time)),  # Seek in audio
                "-i",
                str(audio),
                "-t",
                str(duration_seconds),  # Duration
                "-map",
                "0:v:0",  # Video from first input
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
                cmd.extend(
                    [
                        "-filter_complex",
                        "[0:a:0][1:a:0]amix=inputs=2:duration=first[aout]",
                        "-map",
                        "[aout]",
                    ]
                )

        # Video encoding settings
        cmd.extend(
            [
                "-c:v",
                "libx264",  # Re-encode video (needed for accurate seeking)
                "-preset",
                "ultrafast",  # Fast encoding for preview
                "-crf",
                "28",  # Lower quality for smaller file
            ]
        )

        # Audio encoding (if any audio is present)
        if not (mute_main_audio and mute_secondary_audio):
            cmd.extend(
                [
                    "-c:a",
                    "aac",
                    "-b:a",
                    "128k",
                ]
            )

        cmd.extend(
            [
                "-movflags",
                "+faststart",  # Enable streaming
                str(output_path),
            ]
        )

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            # Extract meaningful error from stderr
            stderr = result.stderr or ""
            # Look for lines containing actual errors
            error_lines = []
            for line in stderr.split("\n"):
                line_lower = line.lower()
                if any(
                    keyword in line_lower
                    for keyword in [
                        "error",
                        "invalid",
                        "failed",
                        "cannot",
                        "unable",
                        "no such",
                        "not found",
                        "does not",
                        "undefined",
                        "unknown",
                    ]
                ):
                    error_lines.append(line.strip())

            if error_lines:
                error_msg = "; ".join(error_lines[-3:])  # Last 3 error lines
            else:
                # Fallback: last 3 non-empty lines
                lines = [l.strip() for l in stderr.split("\n") if l.strip()]
                error_msg = "; ".join(lines[-3:]) if lines else "Unknown FFmpeg error"

            raise ValueError(f"FFmpeg preview generation failed: {error_msg}")

        return PreviewResponse(
            preview_path=str(output_path),
            duration_seconds=duration_seconds,
        )

    def extract_frame(
        self,
        video_path: str,
        time_seconds: float,
        secondary_video_path: str | None = None,
        offset_ms: float = 0.0,
    ) -> FrameResponse:
        """Extract a single frame from video at the specified time.

        If secondary_video_path is provided, generates a side-by-side composite
        with main video on the left and secondary on the right.

        Args:
            video_path: Path to the main video file.
            time_seconds: Time position in seconds for the main video.
            secondary_video_path: Optional path to secondary video for side-by-side.
            offset_ms: Offset in milliseconds for the secondary video.

        Returns:
            FrameResponse with path to the extracted frame image.

        Raises:
            FileNotFoundError: If the video file doesn't exist.
            ValueError: If frame extraction fails.
        """
        video = Path(video_path)
        if not video.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        if secondary_video_path:
            secondary_video = Path(secondary_video_path)
            if not secondary_video.exists():
                raise FileNotFoundError(f"Secondary video file not found: {secondary_video_path}")

        # Generate output path with timestamp to allow caching
        # Use a hash of path + time to create unique filename
        import hashlib

        if secondary_video_path:
            # Include secondary path and offset in hash for side-by-side frames
            hash_input = f"{video_path}:{time_seconds}:{secondary_video_path}:{offset_ms}"
            path_hash = hashlib.md5(hash_input.encode()).hexdigest()[:12]
            output_path = self.temp_dir / f"frame_sbs_{path_hash}.jpg"
        else:
            path_hash = hashlib.md5(f"{video_path}:{time_seconds}".encode()).hexdigest()[:12]
            output_path = self.temp_dir / f"frame_{path_hash}.jpg"

        # If frame already exists, return it (caching)
        if output_path.exists():
            return FrameResponse(frame_path=str(output_path), time_seconds=time_seconds)

        if secondary_video_path:
            # Side-by-side composite frame extraction
            secondary_time_seconds = time_seconds - (offset_ms / 1000.0)

            # Build FFmpeg command with hstack filter
            cmd = [
                "ffmpeg",
                "-y",  # Overwrite output
                "-ss",
                str(max(0, time_seconds)),  # Seek main video
                "-i",
                str(video),
                "-ss",
                str(max(0, secondary_time_seconds)),  # Seek secondary video
                "-i",
                str(secondary_video_path),
                "-filter_complex",
                # Scale both to same height, then stack horizontally
                # Use -2 to ensure even dimensions (required by most codecs)
                "[0:v]scale=-2:720[left];[1:v]scale=-2:720[right];[left][right]hstack=inputs=2",
                "-frames:v",
                "1",  # Extract only one frame
                "-q:v",
                "2",  # High quality JPEG
                str(output_path),
            ]
        else:
            # Single frame extraction (original behavior)
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

    def cleanup_temp_files(self) -> None:
        """Remove all temporary files created by this service."""
        if self.temp_dir.exists():
            for file in self.temp_dir.glob("*.wav"):
                file.unlink()
            for file in self.temp_dir.glob("*.mp4"):
                file.unlink()
            for file in self.temp_dir.glob("*.jpg"):
                file.unlink()
