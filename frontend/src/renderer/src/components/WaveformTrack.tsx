import { useEffect, useRef, useCallback } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import styles from './WaveformTrack.module.css'

interface WaveformTrackProps {
  peaks: number[]
  color: string
  label: string
  duration: number
  offsetMs?: number
  pixelsPerSecond: number
  isDraggable?: boolean
  onOffsetChange?: (deltaMs: number) => void
  isMuted: boolean
  onMuteToggle: () => void
  showOffsetBadge?: boolean
}

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

    const barWidth = 2
    const gap = 1
    const width = peaks.length * (barWidth + gap)
    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = color
    const centerY = height / 2

    peaks.forEach((peak, i) => {
      const x = i * (barWidth + gap)
      const barHeight = Math.max(2, peak * (height - 4))
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight)
    })
  }, [peaks, color, height])

  const width = peaks.length * 3

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, flexShrink: 0 }}
      className={styles.canvas}
    />
  )
}

export function WaveformTrack({
  peaks,
  color,
  label,
  duration,
  offsetMs = 0,
  pixelsPerSecond,
  isDraggable = false,
  onOffsetChange,
  isMuted,
  onMuteToggle,
  showOffsetBadge = false
}: WaveformTrackProps) {
  const isDragging = useRef(false)
  const dragStartX = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggable || !onOffsetChange) return
      e.preventDefault()
      isDragging.current = true
      dragStartX.current = e.clientX
    },
    [isDraggable, onOffsetChange]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !onOffsetChange) return
      const deltaX = e.clientX - dragStartX.current
      const deltaMs = (deltaX / pixelsPerSecond) * 1000
      dragStartX.current = e.clientX
      onOffsetChange(deltaMs)
    },
    [pixelsPerSecond, onOffsetChange]
  )

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  useEffect(() => {
    if (isDraggable) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggable, handleMouseMove, handleMouseUp])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate offset in pixels for positioning
  const offsetPixels = (offsetMs / 1000) * pixelsPerSecond

  return (
    <div className={styles.container}>
      <div className={styles.label}>
        <span className={styles.colorDot} style={{ backgroundColor: color }} />
        {label} ({formatDuration(duration)})
      </div>

      <div
        className={`${styles.waveformWrapper} ${isDraggable ? styles.draggable : ''}`}
        style={{ transform: `translateX(${offsetPixels}px)` }}
        onMouseDown={handleMouseDown}
      >
        <CanvasWaveform peaks={peaks} color={isMuted ? '#666' : color} />
      </div>

      <button
        className={`${styles.muteButton} ${isMuted ? styles.muted : ''}`}
        onClick={onMuteToggle}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      {showOffsetBadge && (
        <span className={styles.offsetBadge}>
          {offsetMs > 0 ? '+' : ''}
          {offsetMs.toFixed(0)}ms
        </span>
      )}
    </div>
  )
}
