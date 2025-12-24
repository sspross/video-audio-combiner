import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import type { FrameResponse } from '../types'
import styles from './VideoFramePreview.module.css'

interface VideoFramePreviewProps {
  videoPath: string | null
  cursorPositionMs: number
  previewPath: string | null
  previewVersion: number
  isGeneratingPreview: boolean
  onPreviewEnded?: () => void
  extractFrame: (videoPath: string, timeSeconds: number) => Promise<FrameResponse>
}

const DEBOUNCE_MS = 150

export function VideoFramePreview({
  videoPath,
  cursorPositionMs,
  previewPath,
  previewVersion,
  isGeneratingPreview,
  onPreviewEnded,
  extractFrame
}: VideoFramePreviewProps) {
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [framePath, setFramePath] = useState<string | null>(null)
  const [isLoadingFrame, setIsLoadingFrame] = useState(false)
  const [frameError, setFrameError] = useState<string | null>(null)
  const [frameVersion, setFrameVersion] = useState(0)

  // Debounced frame extraction
  useEffect(() => {
    if (!videoPath || isPlaying) return

    const timeSeconds = cursorPositionMs / 1000

    const timeoutId = setTimeout(async () => {
      setIsLoadingFrame(true)
      setFrameError(null)

      try {
        const response = await extractFrame(videoPath, timeSeconds)
        setFramePath(response.frame_path)
        setFrameVersion((v) => v + 1)
      } catch (err) {
        setFrameError(err instanceof Error ? err.message : 'Failed to extract frame')
      } finally {
        setIsLoadingFrame(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeoutId)
  }, [videoPath, cursorPositionMs, isPlaying, extractFrame])

  // Reset frame when video path changes
  useEffect(() => {
    setFramePath(null)
    setFrameError(null)
  }, [videoPath])

  // When preview path changes, start playing it
  useEffect(() => {
    if (previewPath && previewVideoRef.current) {
      previewVideoRef.current.load()
      previewVideoRef.current.play()
      setIsPlaying(true)
    }
  }, [previewPath, previewVersion])

  const handlePreviewEnded = useCallback(() => {
    setIsPlaying(false)
    onPreviewEnded?.()
  }, [onPreviewEnded])

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
      {/* Frame image (for scrubbing) - hidden when playing preview */}
      {!isPlaying && frameUrl && (
        <img
          className={styles.video}
          src={frameUrl}
          alt="Video frame"
          style={{ display: 'block', opacity: isLoadingFrame ? 0.5 : 1, transition: 'opacity 150ms' }}
        />
      )}

      {/* Preview video (for playback) - shown when playing */}
      {previewPath && (
        <video
          ref={previewVideoRef}
          className={styles.video}
          src={previewVideoUrl}
          preload="auto"
          controls
          onEnded={handlePreviewEnded}
          style={{ display: isPlaying ? 'block' : 'none' }}
        />
      )}

      {/* Loading spinner over frame */}
      {isLoadingFrame && !isPlaying && framePath && (
        <div className={styles.spinnerOverlay}>
          <Loader2 size={32} className={styles.spinner} />
        </div>
      )}
      {frameError && !isPlaying && (
        <div className={styles.loadingOverlay}>
          <span style={{ color: 'var(--error)' }}>Error: {frameError}</span>
        </div>
      )}
      {!framePath && !frameError && !isPlaying && (
        <div className={styles.loadingOverlay}>
          <Loader2 size={32} className={styles.spinner} />
        </div>
      )}
      {isGeneratingPreview && (
        <div className={styles.loadingOverlay}>
          <span>Generating preview...</span>
        </div>
      )}
    </div>
  )
}
