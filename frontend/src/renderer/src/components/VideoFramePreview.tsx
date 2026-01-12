import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { WaveformSpinner } from './WaveformSpinner'
import type { FrameResponse } from '../types'
import styles from './VideoFramePreview.module.css'

interface VideoFramePreviewProps {
  videoPath: string | null
  cursorPositionMs: number
  previewPath: string | null
  previewVersion: number
  isGeneratingPreview: boolean
  onPreviewEnded?: () => void
  onPlayingChange?: (isPlaying: boolean) => void
  extractFrame: (
    videoPath: string,
    timeSeconds: number,
    secondaryVideoPath?: string,
    offsetMs?: number
  ) => Promise<FrameResponse>
  secondaryVideoPath?: string | null
  offsetMs?: number
}

export interface VideoFramePreviewHandle {
  pause: () => void
  resume: () => void
  isPlaying: () => boolean
}

const DEBOUNCE_MS = 150

export const VideoFramePreview = forwardRef<VideoFramePreviewHandle, VideoFramePreviewProps>(
  function VideoFramePreview(
    {
      videoPath,
      cursorPositionMs,
      previewPath,
      previewVersion,
      isGeneratingPreview,
      onPreviewEnded,
      onPlayingChange,
      extractFrame,
      secondaryVideoPath,
      offsetMs = 0
    },
    ref
  ) {
    const previewVideoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [hasActivePreview, setHasActivePreview] = useState(false)
    const [framePath, setFramePath] = useState<string | null>(null)
    const [isLoadingFrame, setIsLoadingFrame] = useState(false)
    const [frameError, setFrameError] = useState<string | null>(null)
    const [frameVersion, setFrameVersion] = useState(0)

    // Expose control methods via ref
    useImperativeHandle(
      ref,
      () => ({
        pause: () => {
          if (previewVideoRef.current && !previewVideoRef.current.paused) {
            previewVideoRef.current.pause()
            setIsPlaying(false)
            onPlayingChange?.(false)
          }
        },
        resume: () => {
          if (previewVideoRef.current && previewVideoRef.current.paused && previewPath) {
            previewVideoRef.current
              .play()
              .then(() => {
                setIsPlaying(true)
                onPlayingChange?.(true)
              })
              .catch((err) => {
                console.warn('Resume failed:', err)
              })
          }
        },
        isPlaying: () => isPlaying
      }),
      [isPlaying, previewPath, onPlayingChange]
    )

    // Debounced frame extraction (only when no active preview)
    useEffect(() => {
      if (!videoPath || hasActivePreview) return

      const timeSeconds = cursorPositionMs / 1000

      const timeoutId = setTimeout(async () => {
        setIsLoadingFrame(true)
        setFrameError(null)

        try {
          // Pass secondary video path and offset for side-by-side frame extraction
          const response = await extractFrame(
            videoPath,
            timeSeconds,
            secondaryVideoPath ?? undefined,
            offsetMs
          )
          setFramePath(response.frame_path)
          setFrameVersion((v) => v + 1)
        } catch (err) {
          setFrameError(err instanceof Error ? err.message : 'Failed to extract frame')
        } finally {
          setIsLoadingFrame(false)
        }
      }, DEBOUNCE_MS)

      return () => clearTimeout(timeoutId)
    }, [videoPath, cursorPositionMs, hasActivePreview, extractFrame, secondaryVideoPath, offsetMs])

    // Reset frame when video path changes
    useEffect(() => {
      setFramePath(null)
      setFrameError(null)
    }, [videoPath])

    // When preview path changes, start playing it (wait for video to be ready)
    useEffect(() => {
      const video = previewVideoRef.current
      if (!previewPath || !video) return

      // Show the video element immediately so it can load/play properly
      setHasActivePreview(true)

      const handleCanPlay = (): void => {
        video
          .play()
          .then(() => {
            setIsPlaying(true)
            onPlayingChange?.(true)
          })
          .catch((err) => {
            console.warn('Preview playback failed:', err)
            setIsPlaying(false)
          })
      }

      video.addEventListener('canplay', handleCanPlay, { once: true })
      video.load()

      return () => {
        video.removeEventListener('canplay', handleCanPlay)
      }
    }, [previewPath, previewVersion, onPlayingChange])

    // Reset state when preview is cleared
    useEffect(() => {
      if (!previewPath) {
        // Pause video if it's playing
        if (previewVideoRef.current && !previewVideoRef.current.paused) {
          previewVideoRef.current.pause()
        }
        setHasActivePreview(false)
        setIsPlaying(false)
        onPlayingChange?.(false)
      }
    }, [previewPath, onPlayingChange])

    const handlePreviewEnded = useCallback(() => {
      setIsPlaying(false)
      onPlayingChange?.(false)
      onPreviewEnded?.()
    }, [onPreviewEnded, onPlayingChange])

    if (!videoPath) {
      return (
        <div className={styles.container}>
          <div className={styles.placeholder}>No video loaded</div>
        </div>
      )
    }

    const previewVideoUrl = previewPath
      ? `local-video://${encodeURIComponent(previewPath)}?v=${previewVersion}`
      : ''

    const frameUrl = framePath
      ? `local-video://${encodeURIComponent(framePath)}?v=${frameVersion}`
      : ''

    return (
      <div className={styles.container}>
        {/* Frame image (for scrubbing) - hidden when preview is active */}
        {!hasActivePreview && frameUrl && (
          <img
            className={styles.video}
            src={frameUrl}
            alt="Video frame"
          />
        )}

        {/* Preview video (for playback) - shown when preview is active (playing or paused) */}
        {previewPath && (
          <video
            ref={previewVideoRef}
            className={styles.video}
            src={previewVideoUrl}
            preload="none"
            loop
            controls
            onPlay={() => {
              setIsPlaying(true)
              onPlayingChange?.(true)
            }}
            onPause={() => {
              setIsPlaying(false)
              onPlayingChange?.(false)
            }}
            onEnded={handlePreviewEnded}
            onError={() => {
              const video = previewVideoRef.current
              const error = video?.error
              console.error('Video error:', {
                code: error?.code,
                message: error?.message,
                MEDIA_ERR_ABORTED: error?.code === 1,
                MEDIA_ERR_NETWORK: error?.code === 2,
                MEDIA_ERR_DECODE: error?.code === 3,
                MEDIA_ERR_SRC_NOT_SUPPORTED: error?.code === 4,
                src: video?.src
              })
              setIsPlaying(false)
            }}
            style={{ display: hasActivePreview ? 'block' : 'none' }}
          />
        )}

        {/* Loading spinner over frame */}
        {isLoadingFrame && !hasActivePreview && framePath && (
          <div className={styles.spinnerOverlay}>
            <WaveformSpinner size="md" />
          </div>
        )}
        {frameError && !hasActivePreview && (
          <div className={styles.loadingOverlay}>
            <span style={{ color: 'var(--error)' }}>Error: {frameError}</span>
          </div>
        )}
        {!framePath && !frameError && !hasActivePreview && (
          <div className={styles.loadingOverlay}>
            <WaveformSpinner size="md" />
          </div>
        )}
        {isGeneratingPreview && (
          <div className={styles.spinnerOverlay}>
            <WaveformSpinner size="md" />
          </div>
        )}
      </div>
    )
  }
)
