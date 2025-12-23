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


class PreviewResponse(BaseModel):
    """Response containing preview clip path."""

    preview_path: str
    duration_seconds: float
