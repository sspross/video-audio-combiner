import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, FolderOpen, Grid3X3 } from 'lucide-react'
import { WaveformTrack } from './WaveformTrack'
import { TimelineCursor } from './TimelineCursor'
import { PreviewRangeSelector } from './PreviewRangeSelector'
import { WizardFooter, WizardButton } from './wizard'
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
      <button
        className={`${styles.muteButton} ${isMuted ? styles.muted : ''} ${!hasFile ? styles.controlDisabled : ''}`}
        onClick={onMuteToggle}
        title={isMuted ? 'Unmute' : 'Mute'}
        disabled={!hasFile}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  )
}

interface AlignmentEditorProps {
  canContinue: boolean
}

export function AlignmentEditor({ canContinue }: AlignmentEditorProps) {
  const store = useProjectStore()
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const [sidebarWidth, setSidebarWidth] = useState(220)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const justFinishedDragging = useRef(false)
  const isDraggingDivider = useRef(false)

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
  const getTrackDisplayInfo = (track: { index: number; title?: string | null; language?: string | null; codec?: string; channels?: number; duration_seconds?: number } | undefined): { title: string; details: string } => {
    if (!track) return { title: 'No track', details: '—' }

    // Title: Language uppercase or Track N fallback
    const title = track.language
      ? track.language.toUpperCase()
      : `Track ${track.index + 1}`

    // Details: Title - CODEC - Nch - Duration (dash separator)
    const parts: string[] = []
    if (track.title) parts.push(track.title)
    if (track.codec) parts.push(track.codec.toUpperCase())
    if (track.channels) parts.push(`${track.channels}ch`)
    if (track.duration_seconds) parts.push(formatDuration(track.duration_seconds))

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

      // Position preview range start at the clicked position
      const newStartTimeMs = Math.max(
        0,
        Math.min(mainDuration * 1000 - store.previewDurationSeconds * 1000, clickTimeSeconds * 1000)
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

  // Handle sidebar resize divider drag
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingDivider.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left
      setSidebarWidth(Math.max(120, Math.min(400, newWidth)))
    }

    const handleMouseUp = () => {
      if (isDraggingDivider.current) {
        isDraggingDivider.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

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

  // Handle open wizard button (for empty state)
  const handleOpenWizard = useCallback(() => {
    store.setShowSetupWizard(true)
    store.setSetupWizardStep('files-tracks')
  }, [store])

  // Handle back button - opens wizard (analysis state preserved for quick return)
  const handleBack = useCallback(() => {
    store.setShowSetupWizard(true)
    store.setSetupWizardStep('files-tracks')
  }, [store])

  // Handle continue button - opens export modal
  const handleContinue = useCallback(() => {
    // Initialize language from secondary track
    const secondaryTrack = store.secondaryTracks[store.selectedSecondaryTrackIndex]
    if (secondaryTrack?.language) {
      store.setExportLanguage(secondaryTrack.language.toUpperCase())
    }
    store.setShowExportModal(true)
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
              className={`${styles.offsetIndicator} ${styles.offsetIndicatorMain}`}
              style={{ width: mainStartOffset }}
            />
          )}
          <WaveformTrack
            peaks={displayMainPeaks}
            color="#16A34A"
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
              className={`${styles.offsetIndicator} ${styles.offsetIndicatorSecondary}`}
              style={{ width: secondaryStartOffset }}
            />
          )}
          <WaveformTrack
            peaks={displaySecondaryPeaks}
            color="#E85858"
            pixelsPerSecond={pixelsPerSecond}
            isDraggable
            onOffsetChange={handleOffsetChange}
            onDragStateChange={handlePreviewDragStateChange}
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
        <div className={styles.headersSidebar} style={{ width: sidebarWidth }}>
          {/* Spacer to align with timeline ruler */}
          <div className={styles.rulerSpacer} />
          <TrackHeader
            title={mainTrackInfo.title}
            details={mainTrackInfo.details}
            isMuted={store.isMainAudioMuted}
            onMuteToggle={store.toggleMainAudioMute}
            hasFile={hasMainFile}
          />
          <TrackHeader
            title={secondaryTrackInfo.title}
            details={secondaryTrackInfo.details}
            isMuted={store.isSecondaryAudioMuted}
            onMuteToggle={store.toggleSecondaryAudioMute}
            hasFile={hasSecondaryFile}
          />
        </div>

        {/* Resize Divider */}
        <div
          className={styles.resizeDivider}
          onMouseDown={handleDividerMouseDown}
        />

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
      <WizardFooter
        leftContent={
          <WizardButton
            variant="secondary"
            onClick={handleBack}
            disabled={store.isLoading}
          >
            Back
          </WizardButton>
        }
        centerContent={
          <>
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
          </>
        }
        rightContent={
          <WizardButton
            onClick={handleContinue}
            disabled={!canContinue}
          >
            Continue
          </WizardButton>
        }
      />
    </div>
  )
}
