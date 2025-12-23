"""FFmpeg service for video/audio operations."""

import json
import subprocess
import tempfile
from pathlib import Path

from video_audio_combiner.api.schemas import (
    AudioTrack,
    ExtractResponse,
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
    ) -> MergeResponse:
        """Merge an audio track into a video file.

        Args:
            video_path: Path to the original video file.
            audio_path: Path to the audio file to add.
            offset_ms: Offset in milliseconds for the audio.
            output_path: Path for the output file.
            language: Language code for the audio track.
            title: Title for the audio track.

        Returns:
            MergeResponse with result information.
        """
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

        cmd.append(output_path)

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            return MergeResponse(output_path=output_path, success=True)
        except subprocess.CalledProcessError as e:
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
    ) -> PreviewResponse:
        """Generate a preview clip with combined audio.

        Args:
            video_path: Path to the original video file.
            audio_path: Path to the new audio file (WAV).
            start_time_seconds: Start time in the main video timeline.
            duration_seconds: Duration of the preview clip.
            offset_ms: Audio offset in milliseconds.

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

        # Build FFmpeg command
        # We create a preview with:
        # - Video from the main file (with original audio muted)
        # - Audio from the secondary file (mixed or replaced)
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output
            "-ss", str(max(0, start_time_seconds)),  # Seek in video
            "-i", str(video),
            "-ss", str(max(0, audio_start_time)),  # Seek in audio
            "-i", str(audio),
            "-t", str(duration_seconds),  # Duration
            "-map", "0:v:0",  # Video from first input
            "-map", "1:a:0",  # Audio from second input
            "-c:v", "libx264",  # Re-encode video (needed for accurate seeking)
            "-preset", "ultrafast",  # Fast encoding for preview
            "-crf", "28",  # Lower quality for smaller file
            "-c:a", "aac",  # Encode audio
            "-b:a", "128k",
            "-movflags", "+faststart",  # Enable streaming
            str(output_path),
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            raise ValueError(f"FFmpeg preview generation failed: {e.stderr}") from e

        return PreviewResponse(
            preview_path=str(output_path),
            duration_seconds=duration_seconds,
        )

    def cleanup_temp_files(self) -> None:
        """Remove all temporary files created by this service."""
        if self.temp_dir.exists():
            for file in self.temp_dir.glob("*.wav"):
                file.unlink()
            for file in self.temp_dir.glob("*.mp4"):
                file.unlink()
