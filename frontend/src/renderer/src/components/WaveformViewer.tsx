import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './WaveformViewer.module.css'

interface WaveformViewerProps {
  mainPeaks: number[]
  secondaryPeaks: number[]
  mainDuration: number
  secondaryDuration: number
  offsetMs: number
  onPreviewRequest?: (startTimeSeconds: number, durationSeconds: number) => void
  isGeneratingPreview?: boolean
}

// Simple canvas-based waveform renderer
function CanvasWaveform({
  peaks,
  color,
  height = 80
}: {
  peaks: number[]
  color: string
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const barWidth = 2
    const gap = 1
    const width = peaks.length * (barWidth + gap)
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw waveform
    ctx.fillStyle = color
    const centerY = height / 2

    peaks.forEach((peak, i) => {
      const x = i * (barWidth + gap)
      const barHeight = Math.max(2, peak * (height - 4))
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight)
    })
  }, [peaks, color, height])

  const width = peaks.length * 3 // barWidth + gap = 3

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, flexShrink: 0 }}
      className={styles.canvas}
    />
  )
}

export function WaveformViewer({
  mainPeaks,
  secondaryPeaks,
  mainDuration,
  secondaryDuration,
  offsetMs,
  onPreviewRequest,
  isGeneratingPreview = false
}: WaveformViewerProps) {
  const [zoom, setZoom] = useState(1)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [previewStartTime, setPreviewStartTime] = useState(0)
  const [previewDuration, setPreviewDuration] = useState(30)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null)
  const dragStartX = useRef(0)
  const dragStartTime = useRef(0)
  const dragStartDuration = useRef(0)
  const justFinishedDragging = useRef(false)
  const minPreviewDuration = 5
  const maxPreviewDuration = 120

  // Scroll to center the preview area when zoom changes
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)

    // Schedule scroll adjustment after render
    requestAnimationFrame(() => {
      if (!scrollContainerRef.current || mainDuration <= 0) return

      const container = scrollContainerRef.current
      const containerWidth = container.clientWidth

      // Calculate new pixels per second at new zoom level
      const maxPeaks = Math.floor(2000 * newZoom)
      const newDisplayMainPixelWidth = Math.min(mainPeaks.length, maxPeaks) * 3 // pixelsPerPeak = 3
      const newPixelsPerSecond = mainDuration > 0 ? newDisplayMainPixelWidth / mainDuration : 0

      // Calculate the center of the preview in pixels
      const previewCenterTime = previewStartTime + previewDuration / 2
      const previewCenterPixels = previewCenterTime * newPixelsPerSecond

      // Scroll so the preview center is in the middle of the container
      container.scrollLeft = previewCenterPixels - containerWidth / 2
    })
  }, [mainDuration, mainPeaks.length, previewStartTime, previewDuration])

  // Downsample peaks for display if too many
  const downsamplePeaks = useCallback((peaks: number[], targetLength: number): number[] => {
    if (peaks.length <= targetLength) return peaks
    const ratio = peaks.length / targetLength
    const result: number[] = []
    for (let i = 0; i < targetLength; i++) {
      const start = Math.floor(i * ratio)
      const end = Math.floor((i + 1) * ratio)
      let max = 0
      for (let j = start; j < end && j < peaks.length; j++) {
        max = Math.max(max, peaks[j])
      }
      result.push(max)
    }
    return result
  }, [])

  // Calculate pixel dimensions
  const pixelsPerPeak = 3 // barWidth + gap
  const offsetSeconds = offsetMs / 1000

  // Limit peaks for performance (show ~2000 points max at zoom 1)
  const maxPeaks = Math.floor(2000 * zoom)
  const displayMainPeaks = downsamplePeaks(mainPeaks, maxPeaks)
  const displaySecondaryPeaks = downsamplePeaks(secondaryPeaks, maxPeaks)

  // Calculate offsets for downsampled peaks
  const displayMainPixelWidth = displayMainPeaks.length * pixelsPerPeak
  const displayMainPixelsPerSecond = mainDuration > 0 ? displayMainPixelWidth / mainDuration : 0
  const displayOffsetPixels = Math.round(offsetSeconds * displayMainPixelsPerSecond)

  // Calculate start offsets - which waveform needs padding
  const mainStartOffset = displayOffsetPixels < 0 ? Math.abs(displayOffsetPixels) : 0
  const secondaryStartOffset = displayOffsetPixels > 0 ? displayOffsetPixels : 0

  // Calculate total width (max of both waveforms with their offsets)
  const mainTotalWidth = mainStartOffset + displayMainPixelWidth
  const secondaryTotalWidth = secondaryStartOffset + (displaySecondaryPeaks.length * pixelsPerPeak)
  const totalWidth = Math.max(mainTotalWidth, secondaryTotalWidth)

  // Calculate preview range width and position based on pixels per second
  const previewRangeWidth = Math.max(20, previewDuration * displayMainPixelsPerSecond)
  const previewPositionPixels = previewStartTime * displayMainPixelsPerSecond

  // Click handler to jump preview to clicked position
  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore click if we just finished dragging/resizing
    if (justFinishedDragging.current) {
      justFinishedDragging.current = false
      return
    }
    if (!scrollContainerRef.current || isResizing || isDragging) return

    const container = scrollContainerRef.current
    const rect = container.getBoundingClientRect()
    const clickX = e.clientX - rect.left + container.scrollLeft

    // Account for mainStartOffset and convert to time
    const clickTime = (clickX - mainStartOffset) / displayMainPixelsPerSecond

    // Center the preview on the clicked position
    const newStartTime = Math.max(0, Math.min(mainDuration - previewDuration, clickTime - previewDuration / 2))
    setPreviewStartTime(newStartTime)
  }, [mainStartOffset, displayMainPixelsPerSecond, mainDuration, previewDuration, isResizing, isDragging])

  // Drag handlers for the preview range
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartTime.current = previewStartTime
  }, [previewStartTime])

  // Resize handlers for left and right edges
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(edge)
    dragStartX.current = e.clientX
    dragStartTime.current = previewStartTime
    dragStartDuration.current = previewDuration
  }, [previewStartTime, previewDuration])

  const handleDragMove = useCallback((e: MouseEvent) => {
    const deltaX = e.clientX - dragStartX.current
    const deltaTime = deltaX / displayMainPixelsPerSecond

    if (isDragging) {
      const newTime = Math.max(0, Math.min(mainDuration - previewDuration, dragStartTime.current + deltaTime))
      setPreviewStartTime(newTime)
    } else if (isResizing === 'left') {
      // Dragging left edge: adjust start time and duration
      const newStartTime = Math.max(0, dragStartTime.current + deltaTime)
      const newDuration = dragStartDuration.current - deltaTime
      if (newDuration >= minPreviewDuration && newDuration <= maxPreviewDuration && newStartTime >= 0) {
        setPreviewStartTime(newStartTime)
        setPreviewDuration(newDuration)
      }
    } else if (isResizing === 'right') {
      // Dragging right edge: only adjust duration
      const newDuration = Math.max(minPreviewDuration, Math.min(maxPreviewDuration, dragStartDuration.current + deltaTime))
      const maxDuration = mainDuration - previewStartTime
      setPreviewDuration(Math.min(newDuration, maxDuration))
    }
  }, [isDragging, isResizing, displayMainPixelsPerSecond, mainDuration, previewDuration, previewStartTime])

  const handleDragEnd = useCallback(() => {
    if (isDragging || isResizing) {
      justFinishedDragging.current = true
    }
    setIsDragging(false)
    setIsResizing(null)
  }, [isDragging, isResizing])

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, isResizing, handleDragMove, handleDragEnd])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Waveform Comparison</span>
        <div className={styles.timeDisplay}>
          Preview: <strong>{formatTime(previewStartTime)}</strong> - <strong>{formatTime(previewStartTime + previewDuration)}</strong> ({Math.round(previewDuration)}s)
        </div>
        <div className={styles.zoomControls}>
          <span className={styles.zoomLabel}>Zoom:</span>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className={styles.zoomSlider}
          />
          <span className={styles.zoomValue}>{zoom.toFixed(1)}x</span>
        </div>
      </div>

      {/* Waveform labels */}
      <div className={styles.labels}>
        <div className={styles.waveformLabel}>
          <span className={styles.dot} style={{ backgroundColor: 'var(--waveform-main)' }} />
          Main Audio ({formatDuration(mainDuration)})
        </div>
        <div className={styles.waveformLabel}>
          <span className={styles.dot} style={{ backgroundColor: 'var(--waveform-secondary)' }} />
          New Audio ({formatDuration(secondaryDuration)})
          <span className={styles.offsetBadge}>
            {offsetMs > 0 ? '+' : ''}{offsetMs.toFixed(0)}ms
          </span>
        </div>
      </div>

      {/* Combined waveform view */}
      <div className={styles.waveformContainer}>
        {/* Scrollable waveform area */}
        <div
          ref={scrollContainerRef}
          className={styles.waveformScroll}
        >
          <div
            className={styles.waveformContent}
            style={{ width: totalWidth }}
            onClick={handleWaveformClick}
          >
            {/* Preview range indicator - draggable and resizable */}
            <div
              className={`${styles.previewRange} ${isDragging || isResizing ? styles.dragging : ''}`}
              style={{
                width: previewRangeWidth,
                left: mainStartOffset + previewPositionPixels
              }}
            >
              {/* Left resize handle */}
              <div
                className={styles.resizeHandle}
                style={{ left: 0 }}
                onMouseDown={(e) => handleResizeStart(e, 'left')}
              />
              {/* Main draggable area */}
              <div
                className={styles.previewRangeBar}
                onMouseDown={handleDragStart}
                title="Drag to position preview range"
              />
              <span className={styles.previewRangeLabel}>{Math.round(previewDuration)}s</span>
              {/* Right resize handle */}
              <div
                className={styles.resizeHandle}
                style={{ right: 0 }}
                onMouseDown={(e) => handleResizeStart(e, 'right')}
              />
            </div>

            {/* Main waveform track */}
            <div className={styles.waveformTrack}>
              {mainStartOffset > 0 && (
                <div style={{ width: mainStartOffset, flexShrink: 0 }} />
              )}
              <CanvasWaveform peaks={displayMainPeaks} color="#4ade80" />
            </div>

            {/* Secondary waveform track */}
            <div className={styles.waveformTrack}>
              {secondaryStartOffset > 0 && (
                <div style={{ width: secondaryStartOffset, flexShrink: 0 }} />
              )}
              <CanvasWaveform peaks={displaySecondaryPeaks} color="#e94560" />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendIcon}>↔</span>
          Scroll to navigate through the timeline
        </div>
        <div className={styles.legendItem}>
          {offsetMs > 0 ? (
            <span>New audio starts <strong>{(offsetMs / 1000).toFixed(2)}s later</strong></span>
          ) : offsetMs < 0 ? (
            <span>New audio starts <strong>{(Math.abs(offsetMs) / 1000).toFixed(2)}s earlier</strong></span>
          ) : (
            <span>Audio tracks are aligned</span>
          )}
        </div>
        {onPreviewRequest && (
          <button
            className={styles.previewButton}
            onClick={() => onPreviewRequest(previewStartTime, previewDuration)}
            disabled={isGeneratingPreview}
          >
            {isGeneratingPreview ? 'Generating...' : '▶ Preview'}
          </button>
        )}
      </div>
    </div>
  )
}
