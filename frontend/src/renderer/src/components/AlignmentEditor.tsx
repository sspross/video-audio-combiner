import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { WaveformTrack } from './WaveformTrack'
import { TimelineCursor } from './TimelineCursor'
import { useProjectStore } from '../stores/projectStore'
import styles from './AlignmentEditor.module.css'

interface AlignmentEditorProps {
  onAutoDetect: () => void
  isAutoDetecting: boolean
}

export function AlignmentEditor({
  onAutoDetect,
  isAutoDetecting
}: AlignmentEditorProps) {
  const store = useProjectStore()
  const [zoom, setZoom] = useState(1)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasWaveforms = store.mainPeaks.length > 0 && store.secondaryPeaks.length > 0

  // Downsample peaks for display
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

  // Calculate display values
  const pixelsPerPeak = 3
  const maxPeaks = Math.floor(2000 * zoom)
  const displayMainPeaks = downsamplePeaks(store.mainPeaks, maxPeaks)
  const displaySecondaryPeaks = downsamplePeaks(store.secondaryPeaks, maxPeaks)

  const mainDuration =
    store.mainTracks[store.selectedMainTrackIndex]?.duration_seconds || 0
  const secondaryDuration =
    store.secondaryTracks[store.selectedSecondaryTrackIndex]?.duration_seconds || 0

  const displayMainPixelWidth = displayMainPeaks.length * pixelsPerPeak
  const pixelsPerSecond = mainDuration > 0 ? displayMainPixelWidth / mainDuration : 0

  // Calculate offsets for positioning
  const offsetSeconds = store.offsetMs / 1000
  const offsetPixels = Math.round(offsetSeconds * pixelsPerSecond)
  const mainStartOffset = offsetPixels < 0 ? Math.abs(offsetPixels) : 0
  const secondaryStartOffset = offsetPixels > 0 ? offsetPixels : 0

  // Total width calculation
  const mainTotalWidth = mainStartOffset + displayMainPixelWidth
  const secondaryTotalWidth =
    secondaryStartOffset + displaySecondaryPeaks.length * pixelsPerPeak
  const totalWidth = Math.max(mainTotalWidth, secondaryTotalWidth)

  // Handle click on waveform area to set cursor position
  const handleWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!scrollContainerRef.current) return

      const container = scrollContainerRef.current
      const rect = container.getBoundingClientRect()
      const clickX = e.clientX - rect.left + container.scrollLeft

      // Account for mainStartOffset and convert to time
      const clickTime = (clickX - mainStartOffset) / pixelsPerSecond
      const clampedTime = Math.max(0, Math.min(mainDuration, clickTime))
      store.setCursorPosition(clampedTime * 1000)
    },
    [mainStartOffset, pixelsPerSecond, mainDuration, store]
  )

  // Handle offset change from dragging secondary waveform
  const handleOffsetChange = useCallback(
    (deltaMs: number) => {
      store.setOffset(store.offsetMs + deltaMs)
    },
    [store]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return

      const step = e.shiftKey ? 1 : 10 // 1ms with Shift, 10ms otherwise

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        store.setOffset(store.offsetMs - step)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        store.setOffset(store.offsetMs + step)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [store])

  // Scroll to cursor when zoom changes
  const handleZoomChange = useCallback(
    (newZoom: number) => {
      setZoom(newZoom)

      requestAnimationFrame(() => {
        if (!scrollContainerRef.current || mainDuration <= 0) return

        const container = scrollContainerRef.current
        const containerWidth = container.clientWidth

        const newMaxPeaks = Math.floor(2000 * newZoom)
        const newDisplayWidth = Math.min(store.mainPeaks.length, newMaxPeaks) * pixelsPerPeak
        const newPixelsPerSecond = mainDuration > 0 ? newDisplayWidth / mainDuration : 0

        const cursorPixels = (store.cursorPositionMs / 1000) * newPixelsPerSecond
        container.scrollLeft = cursorPixels - containerWidth / 2
      })
    },
    [mainDuration, store.mainPeaks.length, store.cursorPositionMs]
  )

  if (!hasWaveforms) {
    return (
      <div className={styles.container} ref={containerRef}>
        <div className={styles.placeholder}>
          Select video files to view waveforms
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} ref={containerRef} tabIndex={0}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarSection}>
          <div className={styles.offsetDisplay}>
            Offset:
            <span className={styles.offsetValue}>
              {store.offsetMs > 0 ? '+' : ''}
              {store.offsetMs.toFixed(0)}ms
            </span>
          </div>
          <button
            className={styles.autoDetectButton}
            onClick={onAutoDetect}
            disabled={isAutoDetecting}
            title="Auto-detect alignment"
          >
            {isAutoDetecting ? (
              <Loader2 size={14} className={styles.spinner} />
            ) : (
              <Wand2 size={14} />
            )}
            Auto
          </button>
        </div>

        <div className={styles.toolbarSection}>
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

        <div className={styles.instructions}>
          <span className={styles.instruction}>
            Click to position cursor
          </span>
          <span className={styles.instruction}>
            Drag red track to adjust
          </span>
          <span className={styles.instruction}>
            <span className={styles.kbd}>←</span>
            <span className={styles.kbd}>→</span>
            Fine-tune
          </span>
        </div>
      </div>

      {/* Waveform Section */}
      <div className={styles.waveformSection}>
        <div ref={scrollContainerRef} className={styles.waveformScroll}>
          <div
            className={styles.waveformContent}
            style={{ width: totalWidth }}
            onClick={handleWaveformClick}
          >
            {/* Timeline Cursor */}
            <TimelineCursor
              positionMs={store.cursorPositionMs}
              pixelsPerSecond={pixelsPerSecond}
              baseOffset={mainStartOffset}
            />

            {/* Main waveform track */}
            <div
              className={styles.waveformTrackWrapper}
              style={{ marginLeft: mainStartOffset }}
            >
              <WaveformTrack
                peaks={displayMainPeaks}
                color="#4ade80"
                label="Main Audio"
                duration={mainDuration}
                pixelsPerSecond={pixelsPerSecond}
                isMuted={store.isMainAudioMuted}
                onMuteToggle={store.toggleMainAudioMute}
              />
            </div>

            {/* Secondary waveform track (draggable) */}
            <div
              className={styles.waveformTrackWrapper}
              style={{ marginLeft: secondaryStartOffset }}
            >
              <WaveformTrack
                peaks={displaySecondaryPeaks}
                color="#e94560"
                label="New Audio"
                duration={secondaryDuration}
                offsetMs={store.offsetMs}
                pixelsPerSecond={pixelsPerSecond}
                isDraggable
                onOffsetChange={handleOffsetChange}
                isMuted={store.isSecondaryAudioMuted}
                onMuteToggle={store.toggleSecondaryAudioMute}
                showOffsetBadge
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
