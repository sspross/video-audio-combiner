"""Pydantic schemas for API requests and responses."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str


class AudioTrack(BaseModel):
    """Audio track metadata."""

    index: int
    codec: str
    language: str | None
    title: str | None
    channels: int
    sample_rate: int
    duration_seconds: float


class TracksResponse(BaseModel):
    """Response containing audio tracks from a video file."""

    file_path: str
    duration_seconds: float
    tracks: list[AudioTrack]


class ExtractRequest(BaseModel):
    """Request to extract an audio track."""

    file_path: str
    track_index: int


class ExtractResponse(BaseModel):
    """Response after extracting audio."""

    wav_path: str
    duration_seconds: float


class WaveformRequest(BaseModel):
    """Request to generate waveform data."""

    wav_path: str
    samples_per_second: int = 100


class WaveformResponse(BaseModel):
    """Response containing waveform peaks data."""

    peaks: list[float]
    duration_seconds: float
    sample_rate: int


class AlignRequest(BaseModel):
    """Request to detect alignment between two audio files."""

    main_wav_path: str
    secondary_wav_path: str


class AlignResponse(BaseModel):
    """Response containing alignment result."""

    offset_ms: float
    confidence: float


class MergeRequest(BaseModel):
    """Request to merge audio track into video."""

    video_path: str
    audio_path: str
    offset_ms: float
    output_path: str
    language: str = "und"
    title: str | None = None
    modify_original: bool = False


class MergeResponse(BaseModel):
    """Response after merging audio."""

    output_path: str
    success: bool


class PreviewRequest(BaseModel):
    """Request to generate a preview clip."""

    video_path: str
    audio_path: str
    start_time_seconds: float
    duration_seconds: float = 10.0
    offset_ms: float
    mute_main_audio: bool = True
    mute_secondary_audio: bool = False


class PreviewResponse(BaseModel):
    """Response containing preview clip path."""

    preview_path: str
    duration_seconds: float


class FrameRequest(BaseModel):
    """Request to extract a single frame from video."""

    video_path: str
    time_seconds: float


class FrameResponse(BaseModel):
    """Response containing extracted frame path."""

    frame_path: str
    time_seconds: float


# Multi-segment alignment schemas


class SegmentAlignRequest(BaseModel):
    """Request to detect alignment for a specific time segment."""

    main_wav_path: str
    secondary_wav_path: str
    start_time_ms: float
    end_time_ms: float


class DriftDetectionRequest(BaseModel):
    """Request to detect drift points across the full audio."""

    main_wav_path: str
    secondary_wav_path: str
    segment_duration_ms: int = 30000  # 30-second windows
    step_ms: int = 15000  # 15-second steps
    drift_threshold_ms: int = 500  # Minimum offset change to count as drift


class DriftPoint(BaseModel):
    """A point where the alignment offset changes significantly."""

    timestamp_ms: float  # Where the drift occurs in the main timeline
    offset_before_ms: float  # Offset before this point
    offset_after_ms: float  # Offset after this point
    confidence: float


class AudioSegment(BaseModel):
    """A segment of audio with its own alignment offset."""

    start_time_ms: float
    end_time_ms: float
    offset_ms: float
    confidence: float


class DriftDetectionResponse(BaseModel):
    """Response containing detected drift points and segments."""

    drift_points: list[DriftPoint]
    segments: list[AudioSegment]
    scan_duration_seconds: float  # How long the scan took


class CompensateRequest(BaseModel):
    """Request to compensate audio for multi-segment alignment."""

    audio_path: str
    segments: list[AudioSegment]
    crossfade_ms: int = 50  # Crossfade duration at segment boundaries


class CompensateResponse(BaseModel):
    """Response after audio compensation."""

    compensated_path: str
    total_silence_inserted_ms: float
    total_trimmed_ms: float
