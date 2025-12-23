import styles from './TimelineCursor.module.css'

interface TimelineCursorProps {
  positionMs: number
  pixelsPerSecond: number
  baseOffset?: number
  showTimeLabel?: boolean
}

export function TimelineCursor({
  positionMs,
  pixelsPerSecond,
  baseOffset = 0,
  showTimeLabel = false
}: TimelineCursorProps) {
  const positionPixels = baseOffset + (positionMs / 1000) * pixelsPerSecond

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000
    const mins = Math.floor(totalSeconds / 60)
    const secs = Math.floor(totalSeconds % 60)
    const milliseconds = Math.floor((totalSeconds % 1) * 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
  }

  return (
    <div className={styles.cursor} style={{ left: positionPixels }}>
      {showTimeLabel && <span className={styles.timeLabel}>{formatTime(positionMs)}</span>}
    </div>
  )
}
