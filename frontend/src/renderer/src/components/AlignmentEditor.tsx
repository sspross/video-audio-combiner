import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Wand2, Volume2, VolumeX, FolderOpen } from 'lucide-react'
import { WaveformTrack } from './WaveformTrack'
import { TimelineCursor } from './TimelineCursor'
import { PreviewRangeSelector } from './PreviewRangeSelector'
import { useProjectStore } from '../stores/projectStore'
import styles from './AlignmentEditor.module.css'

interface TrackHeaderProps {
  label: string
  color: string
  filePath: string | null
  fileName: string | null
  duration?: number
  isMuted: boolean
  onMuteToggle: () => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function TrackHeader({
  label,
  color,
  filePath,
  fileName,
  duration,
  isMuted,
  onMuteToggle
}: TrackHeaderProps) {
  const hasFile = !!filePath

  return (
    <div className={styles.trackHeader}>
      <div className={styles.trackInfo}>
        <span className={styles.colorDot} style={{ backgroundColor: color }} />
        <div className={styles.trackDetails}>
          <span className={styles.labelText}>{label}</span>
          {hasFile ? (
            <span className={styles.fileName} title={filePath}>
              {fileName}
            </span>
          ) : (
            <span className={styles.fileNamePlaceholder}>No file selected</span>
          )}
        </div>
      </div>
      <div className={styles.trackMeta}>
        <span className={`${styles.durationBadge} ${!hasFile || !duration ? styles.badgeDisabled : ''}`}>
          {duration !== undefined && duration > 0 ? formatDuration(duration) : '—:——'}
        </span>
        <button
          className={`${styles.muteButton} ${isMuted ? styles.muted : ''} ${!hasFile ? styles.controlDisabled : ''}`}
          style={{ '--btn-color': color } as React.CSSProperties}
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
  onAutoDetect: () => void
  isAutoDetecting: boolean
  onSelectMainFile: () => void
  onSelectSecondaryFile: () => void
  onLoadMainFile: (path: string) => void
  onLoadSecondaryFile: (path: string) => void
}

export function AlignmentEditor({
  onAutoDetect,
  isAutoDetecting
}: AlignmentEditorProps) {
  const store = useProjectStore()
  const [zoom, setZoom] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const justFinishedDragging = useRef(false)

  const hasMainFile = !!store.mainFilePath
  const hasSecondaryFile = !!store.secondaryFilePath
  const hasMainPeaks = store.mainPeaks.length > 0
  const hasSecondaryPeaks = store.secondaryPeaks.length > 0
  const hasWaveforms = hasMainPeaks && hasSecondaryPeaks
  const hasAnyFiles = hasMainFile || hasSecondaryFile

  const mainFileName = store.mainFilePath ? store.mainFilePath.split('/').pop() || null : null
  const secondaryFileName = store.secondaryFilePath ? store.secondaryFilePath.split('/').pop() || null : null

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

      // Account for mainStartOffset and convert to time
      const clickTimeSeconds = (clickX - mainStartOffset) / pixelsPerSecond

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
        const newScrollLeft = cursorPixels - containerWidth / 2
        container.scrollLeft = newScrollLeft
      })
    },
    [mainDuration, store.mainPeaks.length, store.cursorPositionMs]
  )

  // Handle open wizard button
  const handleOpenWizard = useCallback(() => {
    store.setShowSetupWizard(true)
    store.setSetupWizardStep('main-video')
  }, [store])

  // Determine what to show in waveform areas
  const mainWaveformContent = () => {
    if (hasMainPeaks) {
      return (
        <div
          className={styles.waveformTrackWrapper}
          style={{ marginLeft: mainStartOffset }}
        >
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
          style={{ marginLeft: secondaryStartOffset }}
        >
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
          <TrackHeader
            label="Main Video"
            color="#4ade80"
            filePath={store.mainFilePath}
            fileName={mainFileName}
            duration={mainDuration}
            isMuted={store.isMainAudioMuted}
            onMuteToggle={store.toggleMainAudioMute}
          />
          <TrackHeader
            label="Audio Source"
            color="#e94560"
            filePath={store.secondaryFilePath}
            fileName={secondaryFileName}
            duration={secondaryDuration}
            isMuted={store.isSecondaryAudioMuted}
            onMuteToggle={store.toggleSecondaryAudioMute}
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
                  baseOffset={mainStartOffset}
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
                  baseOffset={mainStartOffset}
                />

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
            <span className={styles.zoomLabel}>Zoom:</span>
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
        </div>

        <div className={styles.toolbarCenter}>
          <div className={`${styles.offsetDisplay} ${!hasWaveforms ? styles.disabled : ''}`}>
            Offset:
            <span className={styles.offsetValue}>
              {store.offsetMs > 0 ? '+' : ''}
              {store.offsetMs.toFixed(0)}ms
            </span>
          </div>
          <button
            className={styles.autoDetectButton}
            onClick={onAutoDetect}
            disabled={!hasWaveforms || isAutoDetecting}
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

        <div className={`${styles.toolbarRight} ${!hasWaveforms ? styles.disabled : ''}`}>
          <span className={styles.instruction}>
            Click to position preview
          </span>
          <span className={styles.instruction}>
            Drag edges to resize
          </span>
          <span className={styles.instruction}>
            <span className={styles.kbd}>←</span>
            <span className={styles.kbd}>→</span>
            Fine-tune offset
          </span>
        </div>
      </div>
    </div>
  )
}
