import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './PreviewRangeSelector.module.css'

interface PreviewRangeSelectorProps {
  startTimeMs: number
  durationSeconds: number
  pixelsPerSecond: number
  baseOffset: number
  maxTimeMs: number
  minDurationSeconds?: number
  maxDurationSeconds?: number
  onStartTimeChange: (ms: number) => void
  onDurationChange: (seconds: number) => void
  onDragStateChange?: (isDragging: boolean) => void
}

export function PreviewRangeSelector({
  startTimeMs,
  durationSeconds,
  pixelsPerSecond,
  baseOffset,
  maxTimeMs,
  minDurationSeconds = 5,
  maxDurationSeconds = 120,
  onStartTimeChange,
  onDurationChange,
  onDragStateChange
}: PreviewRangeSelectorProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null)
  const dragStartX = useRef(0)
  const dragStartTimeMs = useRef(0)
  const dragStartDuration = useRef(0)

  // Calculate pixel dimensions
  const widthPixels = Math.max(20, durationSeconds * pixelsPerSecond)
  const leftPixels = baseOffset + (startTimeMs / 1000) * pixelsPerSecond

  // Notify parent of drag state changes
  useEffect(() => {
    onDragStateChange?.(isDragging || isResizing !== null)
  }, [isDragging, isResizing, onDragStateChange])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      dragStartX.current = e.clientX
      dragStartTimeMs.current = startTimeMs
    },
    [startTimeMs]
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, edge: 'left' | 'right') => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(edge)
      dragStartX.current = e.clientX
      dragStartTimeMs.current = startTimeMs
      dragStartDuration.current = durationSeconds
    },
    [startTimeMs, durationSeconds]
  )

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX.current
      const deltaTimeMs = (deltaX / pixelsPerSecond) * 1000

      if (isDragging) {
        const maxStartTimeMs = maxTimeMs - durationSeconds * 1000
        const newTimeMs = Math.max(0, Math.min(maxStartTimeMs, dragStartTimeMs.current + deltaTimeMs))
        onStartTimeChange(newTimeMs)
      } else if (isResizing === 'left') {
        // Dragging left edge: adjust start time and duration
        const deltaSeconds = deltaTimeMs / 1000
        const newStartTimeMs = Math.max(0, dragStartTimeMs.current + deltaTimeMs)
        const newDuration = dragStartDuration.current - deltaSeconds

        if (
          newDuration >= minDurationSeconds &&
          newDuration <= maxDurationSeconds &&
          newStartTimeMs >= 0
        ) {
          onStartTimeChange(newStartTimeMs)
          onDurationChange(newDuration)
        }
      } else if (isResizing === 'right') {
        // Dragging right edge: only adjust duration
        const deltaSeconds = deltaTimeMs / 1000
        const newDuration = Math.max(
          minDurationSeconds,
          Math.min(maxDurationSeconds, dragStartDuration.current + deltaSeconds)
        )
        const maxDuration = (maxTimeMs - startTimeMs) / 1000
        onDurationChange(Math.min(newDuration, maxDuration))
      }
    },
    [
      isDragging,
      isResizing,
      pixelsPerSecond,
      maxTimeMs,
      durationSeconds,
      startTimeMs,
      minDurationSeconds,
      maxDurationSeconds,
      onStartTimeChange,
      onDurationChange
    ]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    setIsResizing(null)
  }, [])

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

  return (
    <div
      className={`${styles.previewRange} ${isDragging || isResizing ? styles.dragging : ''}`}
      style={{ left: leftPixels, width: widthPixels }}
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
      {/* Duration label */}
      <span className={styles.durationLabel}>{Math.round(durationSeconds)}s</span>
      {/* Right resize handle */}
      <div
        className={styles.resizeHandle}
        style={{ right: 0 }}
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />
    </div>
  )
}
