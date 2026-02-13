import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Video, Wand2 } from 'lucide-react'
import { VideoFramePreview, VideoFramePreviewHandle } from './VideoFramePreview'
import { WaveformSpinner } from './WaveformSpinner'
import { useProjectStore } from '../stores/projectStore'
import type { FrameResponse } from '../types'
import styles from './PreviewPanel.module.css'

interface PreviewPanelProps {
  previewPath: string | null
  previewVersion: number
  isGeneratingPreview: boolean
  onPreviewRequest: () => void
  onPreviewEnded: () => void
  onStopGeneration?: () => void
  extractFrame: (videoPath: string, timeSeconds: number) => Promise<FrameResponse>
  offsetMs: number
  onAutoDetect: () => void
  isAutoDetecting: boolean
  onPlaybackTimeUpdate?: (absoluteTimeMs: number | null) => void
}

function formatTimeShort(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function PreviewPanel({
  previewPath,
  previewVersion,
  isGeneratingPreview,
  onPreviewRequest,
  onPreviewEnded,
  onStopGeneration,
  extractFrame,
  offsetMs,
  onAutoDetect,
  isAutoDetecting,
  onPlaybackTimeUpdate
}: PreviewPanelProps) {
  const store = useProjectStore()
  const hasWaveforms = store.mainPeaks.length > 0 && store.secondaryPeaks.length > 0
  const videoPreviewRef = useRef<VideoFramePreviewHandle>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing)
  }, [])

  const handleTimeUpdate = useCallback((currentTimeMs: number) => {
    // Convert preview-relative time to absolute timeline time
    const absoluteTimeMs = store.previewStartTimeMs + currentTimeMs
    onPlaybackTimeUpdate?.(absoluteTimeMs)
  }, [store.previewStartTimeMs, onPlaybackTimeUpdate])

  const handlePlayPauseClick = useCallback(() => {
    if (isGeneratingPreview) {
      // Stop generation
      onStopGeneration?.()
    } else if (isPlaying) {
      // Pause playback
      videoPreviewRef.current?.pause()
    } else if (previewPath) {
      // Resume playback
      videoPreviewRef.current?.resume()
    } else {
      // Start generating and playing preview
      onPreviewRequest()
    }
  }, [isGeneratingPreview, isPlaying, previewPath, onPreviewRequest, onStopGeneration])

  // Keyboard listener for space bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input/textarea
      if (
        e.code === 'Space' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault()
        if (hasWaveforms) {
          handlePlayPauseClick()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePlayPauseClick, hasWaveforms])

  const handlePreviewEnded = useCallback(() => {
    setIsPlaying(false)
    onPreviewEnded()
  }, [onPreviewEnded])

  // Determine button icon and state
  const getButtonIcon = () => {
    if (isGeneratingPreview || isPlaying) {
      return <Pause size={16} />
    }
    return <Play size={16} style={{ marginLeft: 1 }} />
  }

  const getButtonTitle = () => {
    if (isGeneratingPreview) return 'Stop generating'
    if (isPlaying) return 'Pause preview'
    if (previewPath) return 'Resume preview'
    return 'Generate and play preview'
  }

  return (
    <div className={styles.panel}>
      {/* Video Container */}
      <div className={styles.videoContainer}>
        {store.mainFilePath ? (
          <VideoFramePreview
            ref={videoPreviewRef}
            videoPath={store.mainFilePath}
            cursorPositionMs={store.cursorPositionMs}
            previewPath={previewPath}
            previewVersion={previewVersion}
            isGeneratingPreview={isGeneratingPreview}
            onPreviewEnded={handlePreviewEnded}
            onPlayingChange={handlePlayingChange}
            onTimeUpdate={handleTimeUpdate}
            extractFrame={extractFrame}
          />
        ) : (
          <div className={styles.placeholder}>
            <Video size={48} className={styles.placeholderIcon} />
            <span>No video loaded</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {/* Guess Offset Button */}
        <button
          className={styles.guessOffsetButton}
          onClick={onAutoDetect}
          disabled={!hasWaveforms || isAutoDetecting}
          title="Auto-detect alignment"
        >
          {isAutoDetecting ? (
            <WaveformSpinner size="sm" />
          ) : (
            <Wand2 size={14} />
          )}
        </button>

        {/* Offset Display */}
        <span className={`${styles.offsetDisplay} ${!hasWaveforms ? styles.disabled : ''}`}>
          {offsetMs > 0 ? '+' : ''}{offsetMs.toFixed(0)}ms
        </span>

        {/* Preview Time Range */}
        <span className={styles.previewTimeRange}>
          {formatTimeShort(store.previewStartTimeMs)} –{' '}
          {formatTimeShort(store.previewStartTimeMs + store.previewDurationSeconds * 1000)}
        </span>

        {/* Play/Pause Button */}
        <button
          className={`${styles.playButton} ${isGeneratingPreview || isPlaying ? styles.active : ''}`}
          onClick={handlePlayPauseClick}
          disabled={!hasWaveforms}
          title={getButtonTitle()}
        >
          {getButtonIcon()}
        </button>
      </div>
    </div>
  )
}
