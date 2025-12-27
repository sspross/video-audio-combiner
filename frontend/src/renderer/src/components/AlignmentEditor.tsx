import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, FolderOpen, RotateCcw, Download, CheckCircle, AlertCircle, Grid3X3 } from 'lucide-react'
import { WaveformSpinner } from './WaveformSpinner'
import { WaveformTrack } from './WaveformTrack'
import { TimelineCursor } from './TimelineCursor'
import { PreviewRangeSelector } from './PreviewRangeSelector'
import { useProjectStore } from '../stores/projectStore'
import styles from './AlignmentEditor.module.css'

// Helper to calculate tick interval based on zoom level
function getTickInterval(pixelsPerSecond: number): number {
  const minPixelsBetweenTicks = 80
  const secondsPerTick = minPixelsBetweenTicks / pixelsPerSecond
  const niceIntervals = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  for (const interval of niceIntervals) {
    if (interval >= secondsPerTick) return interval
  }
  return 600
}

// Timeline ruler component for showing time markers
interface TimelineRulerProps {
  duration: number
  pixelsPerSecond: number
  offsetPx: number
  totalWidth: number
}

function TimelineRuler({ duration, pixelsPerSecond, offsetPx, totalWidth }: TimelineRulerProps) {
  const majorInterval = getTickInterval(pixelsPerSecond)
  const minorInterval = majorInterval / 5

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Generate ticks
  const ticks: { time: number; isMajor: boolean }[] = []
  for (let t = 0; t <= duration; t += minorInterval) {
    const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs(t % majorInterval - majorInterval) < 0.001
    ticks.push({ time: t, isMajor })
  }

  return (
    <div className={styles.timelineRuler} style={{ width: totalWidth }}>
      {ticks.map(({ time, isMajor }) => (
        <div
          key={time}
          className={`${styles.tick} ${isMajor ? styles.majorTick : styles.minorTick}`}
          style={{ left: offsetPx + time * pixelsPerSecond }}
        >
          <div className={styles.tickLine} />
          {isMajor && <span className={styles.tickLabel}>{formatTime(time)}</span>}
        </div>
      ))}
    </div>
  )
}

interface TrackHeaderProps {
  title: string
  details: string
  duration?: number
  isMuted: boolean
  onMuteToggle: () => void
  hasFile: boolean
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function TrackHeader({
  title,
  details,
  duration,
  isMuted,
  onMuteToggle,
  hasFile
}: TrackHeaderProps) {
  return (
    <div className={styles.trackHeader}>
      <div className={styles.trackInfo}>
        <div className={styles.trackDetails}>
          {hasFile ? (
            <>
              <span className={styles.labelText} title={title}>
                {title}
              </span>
              <span className={styles.fileName} title={details}>
                {details}
              </span>
            </>
          ) : (
            <>
              <span className={styles.labelText}>No file selected</span>
              <span className={styles.fileNamePlaceholder}>—</span>
            </>
          )}
        </div>
      </div>
      <div className={styles.trackMeta}>
        <span className={`${styles.durationBadge} ${!hasFile || !duration ? styles.badgeDisabled : ''}`}>
          {duration !== undefined && duration > 0 ? formatDuration(duration) : '—:——'}
        </span>
        <button
          className={`${styles.muteButton} ${isMuted ? styles.muted : ''} ${!hasFile ? styles.controlDisabled : ''}`}
          onClick={onMuteToggle}
          title={isMuted ? 'Unmute' : 'Mute'}
          disabled={!hasFile}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    </div>
  )
}

interface AlignmentEditorProps {
  onSelectMainFile: () => void
  onSelectSecondaryFile: () => void
  onLoadMainFile: (path: string) => void
  onLoadSecondaryFile: (path: string) => void
  onReset: () => void
  onExport: () => void
  exportStatus: 'idle' | 'exporting' | 'success' | 'error'
  exportError: string | null
  canExport: boolean
}

export function AlignmentEditor({
  onReset,
  onExport,
  exportStatus,
  exportError,
  canExport
}: AlignmentEditorProps) {
  const store = useProjectStore()
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const justFinishedDragging = useRef(false)

  // Track scroll container width for minimum content width
  useEffect(() => {
    const updateWidth = () => {
      if (scrollRef.current) {
        setContainerWidth(scrollRef.current.clientWidth)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const hasMainFile = !!store.mainFilePath
  const hasSecondaryFile = !!store.secondaryFilePath
  const hasMainPeaks = store.mainPeaks.length > 0
  const hasSecondaryPeaks = store.secondaryPeaks.length > 0
  const hasWaveforms = hasMainPeaks && hasSecondaryPeaks
  const hasAnyFiles = hasMainFile || hasSecondaryFile

  // Get audio track display info (title + details)
  const getTrackDisplayInfo = (track: { index: number; title?: string | null; language?: string | null; codec?: string; channels?: number } | undefined): { title: string; details: string } => {
    if (!track) return { title: 'No track', details: '—' }

    // Title: Language uppercase or Track N fallback
    const title = track.language
      ? track.language.toUpperCase()
      : `Track ${track.index + 1}`

    // Details: Title - CODEC - Nch (dash separator)
    const parts: string[] = []
    if (track.title) parts.push(track.title)
    if (track.codec) parts.push(track.codec.toUpperCase())
    if (track.channels) parts.push(`${track.channels}ch`)

    return {
      title,
      details: parts.length > 0 ? parts.join(' - ') : '—'
    }
  }

  const mainTrackInfo = getTrackDisplayInfo(store.mainTracks[store.selectedMainTrackIndex])
  const secondaryTrackInfo = getTrackDisplayInfo(store.secondaryTracks[store.selectedSecondaryTrackIndex])

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
  const scrollPaddingPx = 100 // Extra space to scroll past edges
  // Cap maxPeaks to prevent canvas from exceeding browser limits
  // At 10x zoom: 2000 * 10 * 3 = 60000px
  const maxCanvasWidth = 60000
  const maxPeaks = Math.min(Math.floor(2000 * zoom), Math.floor(maxCanvasWidth / pixelsPerPeak))
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

  // Total width calculation (including scroll padding on both sides)
  // Ensure content is at least as wide as the container to fill the viewport
  const mainTotalWidth = mainStartOffset + displayMainPixelWidth
  const secondaryTotalWidth =
    secondaryStartOffset + displaySecondaryPeaks.length * pixelsPerPeak
  const contentWidth = Math.max(mainTotalWidth, secondaryTotalWidth)
  const calculatedWidth = scrollPaddingPx + contentWidth + scrollPaddingPx
  const totalWidth = Math.max(calculatedWidth, containerWidth)

  // Handle click on waveform area to center preview range
  const handleWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Ignore click if we just finished dragging/resizing
      if (justFinishedDragging.current) {
        justFinishedDragging.current = false
        return
      }
      if (!scrollRef.current) return

      const container = scrollRef.current
      const rect = container.getBoundingClientRect()
      const clickX = e.clientX - rect.left + container.scrollLeft

      // Account for scroll padding and mainStartOffset, then convert to time
      const clickTimeSeconds = (clickX - scrollPaddingPx - mainStartOffset) / pixelsPerSecond

      // Center the preview range on the clicked position
      const halfDuration = store.previewDurationSeconds / 2
      const newStartTimeMs = Math.max(
        0,
        Math.min(mainDuration * 1000 - store.previewDurationSeconds * 1000, (clickTimeSeconds - halfDuration) * 1000)
      )
      store.setPreviewStartTime(newStartTimeMs)
      store.setCursorPosition(newStartTimeMs)
    },
    [mainStartOffset, pixelsPerSecond, mainDuration, store]
  )

  // Handle drag state changes from preview range selector
  const handlePreviewDragStateChange = useCallback((isDragging: boolean) => {
    if (!isDragging) {
      // Set flag when drag ends to prevent click handler
      justFinishedDragging.current = true
      // Reset flag after a short delay
      setTimeout(() => {
        justFinishedDragging.current = false
      }, 100)
    }
  }, [])

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
        if (!scrollRef.current || mainDuration <= 0) return

        const container = scrollRef.current
        const containerWidth = container.clientWidth

        const newMaxPeaks = Math.floor(2000 * newZoom)
        const newDisplayWidth = Math.min(store.mainPeaks.length, newMaxPeaks) * pixelsPerPeak
        const newPixelsPerSecond = mainDuration > 0 ? newDisplayWidth / mainDuration : 0

        const cursorPixels = (store.cursorPositionMs / 1000) * newPixelsPerSecond
        const newScrollLeft = scrollPaddingPx + cursorPixels - containerWidth / 2
        container.scrollLeft = newScrollLeft
      })
    },
    [mainDuration, store.mainPeaks.length, store.cursorPositionMs]
  )

  // Handle open wizard button
  const handleOpenWizard = useCallback(() => {
    store.setShowSetupWizard(true)
    store.setSetupWizardStep('files')
  }, [store])

  // Determine what to show in waveform areas
  const mainWaveformContent = () => {
    if (hasMainPeaks) {
      return (
        <div
          className={styles.waveformTrackWrapper}
          style={{ marginLeft: scrollPaddingPx }}
        >
          {/* Orange offset indicator when secondary starts earlier */}
          {mainStartOffset > 0 && (
            <div
              className={styles.offsetIndicator}
              style={{ width: mainStartOffset }}
            />
          )}
          <WaveformTrack
            peaks={displayMainPeaks}
            color="#4ade80"
            pixelsPerSecond={pixelsPerSecond}
            isMuted={store.isMainAudioMuted}
          />
        </div>
      )
    }
    return null
  }

  const secondaryWaveformContent = () => {
    if (hasSecondaryPeaks) {
      return (
        <div
          className={styles.waveformTrackWrapper}
          style={{ marginLeft: scrollPaddingPx }}
        >
          {/* Orange offset indicator at the beginning */}
          {secondaryStartOffset > 0 && (
            <div
              className={styles.offsetIndicator}
              style={{ width: secondaryStartOffset }}
            />
          )}
          <WaveformTrack
            peaks={displaySecondaryPeaks}
            color="#e94560"
            pixelsPerSecond={pixelsPerSecond}
            isDraggable
            onOffsetChange={handleOffsetChange}
            isMuted={store.isSecondaryAudioMuted}
          />
        </div>
      )
    }
    return null
  }

  return (
    <div className={styles.container} ref={containerRef} tabIndex={0}>
      {/* Main content area with headers and waveforms */}
      <div className={styles.mainContent}>
        {/* Track Headers Sidebar */}
        <div className={styles.headersSidebar}>
          {/* Spacer to align with timeline ruler */}
          <div className={styles.rulerSpacer} />
          <TrackHeader
            title={mainTrackInfo.title}
            details={mainTrackInfo.details}
            duration={mainDuration}
            isMuted={store.isMainAudioMuted}
            onMuteToggle={store.toggleMainAudioMute}
            hasFile={hasMainFile}
          />
          <TrackHeader
            title={secondaryTrackInfo.title}
            details={secondaryTrackInfo.details}
            duration={secondaryDuration}
            isMuted={store.isSecondaryAudioMuted}
            onMuteToggle={store.toggleSecondaryAudioMute}
            hasFile={hasSecondaryFile}
          />
        </div>

        {/* Unified Waveform Area */}
        <div className={styles.waveformArea}>
          {hasWaveforms ? (
            // Both waveforms ready - single scroll container
            <div ref={scrollRef} className={styles.waveformScroll}>
              <div
                className={styles.waveformContent}
                style={{ width: totalWidth || '100%' }}
                onClick={handleWaveformClick}
              >
                {/* Preview Range Selector - spans both tracks */}
                <PreviewRangeSelector
                  startTimeMs={store.previewStartTimeMs}
                  durationSeconds={store.previewDurationSeconds}
                  pixelsPerSecond={pixelsPerSecond}
                  baseOffset={scrollPaddingPx + mainStartOffset}
                  maxTimeMs={mainDuration * 1000}
                  onStartTimeChange={(ms) => {
                    store.setPreviewStartTime(ms)
                    store.setCursorPosition(ms)
                  }}
                  onDurationChange={store.setPreviewDuration}
                  onDragStateChange={handlePreviewDragStateChange}
                />

                {/* Timeline Cursor */}
                <TimelineCursor
                  positionMs={store.cursorPositionMs}
                  pixelsPerSecond={pixelsPerSecond}
                  baseOffset={scrollPaddingPx + mainStartOffset}
                />

                {/* Timeline Ruler */}
                <TimelineRuler
                  duration={mainDuration}
                  pixelsPerSecond={pixelsPerSecond}
                  offsetPx={scrollPaddingPx + mainStartOffset}
                  totalWidth={totalWidth}
                />

                {/* Grid Overlay - single div with CSS gradient for performance */}
                {showGrid && (
                  <div
                    className={styles.gridOverlay}
                    style={{
                      backgroundSize: `${getTickInterval(pixelsPerSecond) * pixelsPerSecond}px 100%`,
                      backgroundPosition: `${scrollPaddingPx + mainStartOffset}px 0`,
                      width: totalWidth
                    }}
                  />
                )}

                {/* Track waveforms stacked vertically */}
                <div className={styles.tracksStack}>
                  <div className={styles.trackWaveformRow}>
                    {mainWaveformContent()}
                  </div>
                  <div className={styles.trackWaveformRow}>
                    {secondaryWaveformContent()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Empty state or loading - show placeholder
            <div className={styles.emptyState}>
              <div className={styles.emptyStateContent}>
                <p className={styles.emptyStateText}>
                  {hasAnyFiles ? 'Analyzing audio...' : 'No files loaded'}
                </p>
                {!hasAnyFiles && (
                  <button className={styles.selectFilesButton} onClick={handleOpenWizard}>
                    <FolderOpen size={16} />
                    Select Files
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar - always visible */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={`${styles.zoomControls} ${!hasWaveforms ? styles.disabled : ''}`}>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className={styles.zoomSlider}
              disabled={!hasWaveforms}
            />
            <span className={styles.zoomValue}>{zoom.toFixed(1)}x</span>
          </div>
          <button
            className={`${styles.gridToggle} ${showGrid ? styles.gridActive : ''} ${!hasWaveforms ? styles.disabled : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle grid"
            disabled={!hasWaveforms}
          >
            <Grid3X3 size={14} />
          </button>
        </div>

        <div className={styles.toolbarCenter}>
          {/* Offset controls moved to PreviewPanel */}
        </div>

        <div className={styles.toolbarRight}>
          <button
            className={styles.resetButton}
            onClick={onReset}
            disabled={store.isLoading}
          >
            <RotateCcw size={14} />
            Reset
          </button>
          {exportStatus === 'idle' && (
            <button
              className={styles.exportButton}
              onClick={onExport}
              disabled={!canExport}
            >
              <Download size={14} />
              Export
            </button>
          )}
          {exportStatus === 'exporting' && (
            <button className={styles.exportButton} disabled>
              <WaveformSpinner size="sm" />
              Exporting...
            </button>
          )}
          {exportStatus === 'success' && (
            <button className={styles.exportButtonSuccess} onClick={onExport}>
              <CheckCircle size={14} />
              Done!
            </button>
          )}
          {exportStatus === 'error' && (
            <button className={styles.exportButtonError} onClick={onExport} title={exportError || 'Export failed'}>
              <AlertCircle size={14} />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
