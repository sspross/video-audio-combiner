import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './VideoFramePreview.module.css'

interface VideoFramePreviewProps {
  videoPath: string | null
  cursorPositionMs: number
  previewPath: string | null
  previewVersion: number
  isGeneratingPreview: boolean
  onPreviewEnded?: () => void
}

export function VideoFramePreview({
  videoPath,
  cursorPositionMs,
  previewPath,
  previewVersion,
  isGeneratingPreview,
  onPreviewEnded
}: VideoFramePreviewProps) {
  const frameVideoRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [isFrameLoaded, setIsFrameLoaded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleFrameLoadedData = useCallback(() => {
    setIsFrameLoaded(true)
    // Seek to initial position once loaded
    if (frameVideoRef.current) {
      frameVideoRef.current.currentTime = cursorPositionMs / 1000
    }
  }, [cursorPositionMs])

  // Reset loaded state when video path changes
  useEffect(() => {
    setIsFrameLoaded(false)
  }, [videoPath])

  // Seek to cursor position when it changes (only when not playing preview)
  useEffect(() => {
    if (frameVideoRef.current && isFrameLoaded && !isPlaying) {
      const targetTime = cursorPositionMs / 1000
      if (Math.abs(frameVideoRef.current.currentTime - targetTime) > 0.05) {
        frameVideoRef.current.currentTime = targetTime
      }
    }
  }, [cursorPositionMs, isFrameLoaded, isPlaying])

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

  const frameVideoUrl = `local-video://${encodeURIComponent(videoPath)}`
  const previewVideoUrl = previewPath
    ? `local-video://${encodeURIComponent(previewPath)}?v=${previewVersion}`
    : ''

  return (
    <div className={styles.container}>
      {/* Frame video (for scrubbing) - hidden when playing preview */}
      <video
        ref={frameVideoRef}
        className={styles.video}
        src={frameVideoUrl}
        preload="auto"
        muted
        onLoadedData={handleFrameLoadedData}
        style={{ display: isPlaying ? 'none' : 'block' }}
      />

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

      {/* Loading states */}
      {!isFrameLoaded && !isPlaying && (
        <div className={styles.loadingOverlay}>
          <span>Loading video...</span>
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
