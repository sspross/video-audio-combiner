"""API routes for video audio combiner."""

from fastapi import APIRouter, HTTPException

from video_audio_combiner import __version__
from video_audio_combiner.api.schemas import (
    AlignRequest,
    AlignResponse,
    ExtractRequest,
    ExtractResponse,
    FrameRequest,
    FrameResponse,
    HealthResponse,
    MergeRequest,
    MergeResponse,
    PreviewRequest,
    PreviewResponse,
    TracksResponse,
    WaveformRequest,
    WaveformResponse,
)
from video_audio_combiner.services.ffmpeg_service import FFmpegService

router = APIRouter()
ffmpeg_service = FFmpegService()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Check API health status."""
    return HealthResponse(status="healthy", version=__version__)


@router.post("/analyze/tracks", response_model=TracksResponse)
async def get_audio_tracks(file_path: str) -> TracksResponse:
    """Get list of audio tracks from a video file."""
    try:
        return ffmpeg_service.get_audio_tracks(file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/analyze/extract", response_model=ExtractResponse)
async def extract_audio(request: ExtractRequest) -> ExtractResponse:
    """Extract an audio track to WAV format.

    If target_framerate is provided and differs from source framerate,
    the audio will be automatically stretched to match the target timing.
    """
    try:
        return ffmpeg_service.extract_audio(
            request.file_path, request.track_index, request.target_framerate
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/analyze/waveform", response_model=WaveformResponse)
async def generate_waveform(request: WaveformRequest) -> WaveformResponse:
    """Generate waveform peaks data for visualization."""
    # Import here to avoid loading librosa at startup
    from video_audio_combiner.services.waveform import WaveformService

    waveform_service = WaveformService()
    try:
        return waveform_service.generate_peaks(request.wav_path, request.samples_per_second)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/align/detect", response_model=AlignResponse)
async def detect_alignment(request: AlignRequest) -> AlignResponse:
    """Detect alignment offset between two audio files."""
    # Import here to avoid loading librosa at startup
    from video_audio_combiner.services.alignment import AlignmentService

    alignment_service = AlignmentService()
    try:
        return alignment_service.detect_alignment(request.main_wav_path, request.secondary_wav_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/merge", response_model=MergeResponse)
async def merge_audio(request: MergeRequest) -> MergeResponse:
    """Merge aligned audio track into video file."""
    try:
        return ffmpeg_service.merge_audio(
            video_path=request.video_path,
            audio_path=request.audio_path,
            offset_ms=request.offset_ms,
            output_path=request.output_path,
            language=request.language,
            title=request.title,
            modify_original=request.modify_original,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/preview", response_model=PreviewResponse)
async def generate_preview(request: PreviewRequest) -> PreviewResponse:
    """Generate a preview clip with combined audio.

    If secondary_video_path is provided, generates a side-by-side composite
    with the main video on the left and secondary on the right.
    """
    try:
        return ffmpeg_service.generate_preview(
            video_path=request.video_path,
            audio_path=request.audio_path,
            start_time_seconds=request.start_time_seconds,
            duration_seconds=request.duration_seconds,
            offset_ms=request.offset_ms,
            mute_main_audio=request.mute_main_audio,
            mute_secondary_audio=request.mute_secondary_audio,
            secondary_video_path=request.secondary_video_path,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/extract/frame", response_model=FrameResponse)
async def extract_frame(request: FrameRequest) -> FrameResponse:
    """Extract a single frame from video at the specified time.

    If secondary_video_path is provided, generates a side-by-side composite
    with the main video on the left and secondary on the right.
    """
    try:
        return ffmpeg_service.extract_frame(
            video_path=request.video_path,
            time_seconds=request.time_seconds,
            secondary_video_path=request.secondary_video_path,
            offset_ms=request.offset_ms,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
