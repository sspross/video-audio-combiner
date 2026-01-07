import { useCallback } from 'react'
import { useProjectStore } from '../stores/projectStore'
import styles from './SegmentOverlay.module.css'

interface SegmentOverlayProps {
  pixelsPerSecond: number
  baseOffset: number
  totalHeight: number
}

export function SegmentOverlay({ pixelsPerSecond, baseOffset, totalHeight }: SegmentOverlayProps) {
  const store = useProjectStore()
  const { driftPoints, segments, selectedSegmentId } = store

  const handleSegmentClick = useCallback(
    (segmentId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      store.setSelectedSegmentId(selectedSegmentId === segmentId ? null : segmentId)
    },
    [store, selectedSegmentId]
  )

  if (driftPoints.length === 0 && segments.length <= 1) {
    return null
  }

  return (
    <div className={styles.overlay} style={{ height: totalHeight }}>
      {/* Drift point markers */}
      {driftPoints.map((drift, index) => {
        const leftPx = baseOffset + (drift.timestamp_ms / 1000) * pixelsPerSecond
        const offsetDiff = drift.offset_after_ms - drift.offset_before_ms
        const isPositive = offsetDiff > 0

        return (
          <div
            key={`drift-${index}`}
            className={styles.driftMarker}
            style={{ left: leftPx }}
            title={`Drift at ${formatTime(drift.timestamp_ms)}: ${offsetDiff > 0 ? '+' : ''}${offsetDiff.toFixed(0)}ms`}
          >
            <div className={styles.driftLine} />
            <div className={`${styles.driftLabel} ${isPositive ? styles.driftPositive : styles.driftNegative}`}>
              {offsetDiff > 0 ? '+' : ''}{(offsetDiff / 1000).toFixed(1)}s
            </div>
          </div>
        )
      })}

      {/* Segment backgrounds */}
      {segments.map((segment, index) => {
        const startPx = baseOffset + (segment.start_time_ms / 1000) * pixelsPerSecond
        const endPx = baseOffset + (segment.end_time_ms / 1000) * pixelsPerSecond
        const width = endPx - startPx
        const isSelected = segment.id === selectedSegmentId

        // Alternate segment colors for visibility
        const bgColor = index % 2 === 0 ? 'rgba(74, 222, 128, 0.05)' : 'rgba(233, 69, 96, 0.05)'

        return (
          <div
            key={segment.id}
            className={`${styles.segment} ${isSelected ? styles.segmentSelected : ''}`}
            style={{
              left: startPx,
              width,
              backgroundColor: bgColor
            }}
            onClick={(e) => handleSegmentClick(segment.id, e)}
          >
            <div className={styles.segmentLabel}>
              <span className={styles.segmentOffset}>{segment.offset_ms.toFixed(0)}ms</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
