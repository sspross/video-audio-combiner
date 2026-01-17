import styles from './PlayheadCursor.module.css'

interface PlayheadCursorProps {
  positionMs: number
  pixelsPerSecond: number
  baseOffset: number
}

export function PlayheadCursor({ positionMs, pixelsPerSecond, baseOffset }: PlayheadCursorProps) {
  const positionPixels = baseOffset + (positionMs / 1000) * pixelsPerSecond

  return (
    <div
      className={styles.cursor}
      style={{ transform: `translateX(${positionPixels}px)` }}
    />
  )
}
