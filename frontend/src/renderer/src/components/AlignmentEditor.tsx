import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Wand2, Upload, FolderOpen, X, Volume2, VolumeX } from 'lucide-react'
import { WaveformTrack } from './WaveformTrack'
import { TimelineCursor } from './TimelineCursor'
import { useProjectStore } from '../stores/projectStore'
import type { AnalysisStep, AudioTrack } from '../types'
import styles from './AlignmentEditor.module.css'

interface AnalysisProgressProps {
  step: AnalysisStep
}

function AnalysisProgress({ step }: AnalysisProgressProps) {
  const steps = [
    { key: 'extracting', label: 'Extracting audio...' },
    { key: 'waveform', label: 'Generating waveform...' }
  ]

  const currentIndex = steps.findIndex((s) => s.key === step)

  return (
    <div className={styles.analysisProgress}>
      <div className={styles.progressSteps}>
        {steps.map((s, i) => (
          <div
            key={s.key}
            className={`${styles.progressStep} ${i < currentIndex ? styles.completed : ''} ${s.key === step ? styles.current : ''}`}
          >
            <span className={styles.stepIndicator}>
              {i < currentIndex ? '✓' : i + 1}
            </span>
            <span className={styles.stepLabel}>{s.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.progressBarContainer}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} />
        </div>
      </div>
    </div>
  )
}

interface TrackSelectorProps {
  tracks: AudioTrack[]
  selectedIndex: number
  onSelect: (index: number) => void
  onAnalyze: () => void
}

function TrackSelector({ tracks, selectedIndex, onSelect, onAnalyze }: TrackSelectorProps) {
  const formatTrackLabel = (track: AudioTrack) => {
    const parts = [`Track ${track.index + 1}`]
    if (track.language) parts.push(track.language)
    parts.push(track.codec)
    parts.push(`${track.channels}ch`)
    if (track.title) parts.push(`- ${track.title}`)
    return parts.join(' • ')
  }

  return (
    <div className={styles.trackSelector}>
      <select
        className={styles.trackDropdown}
        value={selectedIndex}
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        {tracks.map((track) => (
          <option key={track.index} value={track.index}>
            {formatTrackLabel(track)}
          </option>
        ))}
      </select>
      <button className={styles.analyzeButton} onClick={onAnalyze}>
        Analyze
      </button>
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

interface TrackRowProps {
  label: string
  color: string
  filePath: string | null
  fileName: string | null
  analysisStep: AnalysisStep
  onSelectFile: () => void
  onFileDrop: (path: string) => void
  onClear: () => void
  isMuted: boolean
  onMuteToggle: () => void
  duration?: number
  children?: React.ReactNode
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function TrackRow({
  label,
  color,
  filePath,
  fileName,
  analysisStep,
  onSelectFile,
  onFileDrop,
  onClear,
  isMuted,
  onMuteToggle,
  duration,
  children
}: TrackRowProps) {
  const isAnalyzing = analysisStep !== 'idle' && analysisStep !== 'pending'
  const hasFile = !!filePath
  void isAnalyzing // Used for future disabled states
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!filePath) {
        setIsDragOver(true)
      }
    },
    [filePath]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const path = window.electron.getPathForFile(files[0])
        if (path) {
          onFileDrop(path)
        }
      }
    },
    [onFileDrop]
  )

  // Always show full layout with header + waveform area
  return (
    <div className={styles.trackRow}>
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
          {hasFile && (
            <button
              className={styles.clearButton}
              onClick={onClear}
              disabled={isAnalyzing}
              title="Clear selection"
            >
              <X size={14} />
            </button>
          )}
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
      <div
        className={`${styles.trackWaveform} ${!hasFile ? styles.dropZone : ''} ${isDragOver ? styles.dragOver : ''}`}
        style={{ '--zone-color': color } as React.CSSProperties}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasFile ? (
          children
        ) : (
          <div className={styles.dropZoneContent}>
            {isDragOver ? (
              <div className={styles.dropHint}>
                <Upload size={24} />
                <span>Drop video file here</span>
              </div>
            ) : (
              <>
                <button className={styles.selectFileButton} onClick={onSelectFile}>
                  <FolderOpen size={14} />
                  Select
                </button>
                <span className={styles.orText}>or drag & drop video file</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function AlignmentEditor({
  onAutoDetect,
  isAutoDetecting,
  onSelectMainFile,
  onSelectSecondaryFile,
  onLoadMainFile,
  onLoadSecondaryFile
}: AlignmentEditorProps) {
  const store = useProjectStore()
  const [zoom, setZoom] = useState(1)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const secondaryScrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isScrollSyncing = useRef(false)

  // Sync scroll positions between main and secondary waveforms
  const handleMainScroll = useCallback(() => {
    if (isScrollSyncing.current) return
    if (!mainScrollRef.current || !secondaryScrollRef.current) return
    isScrollSyncing.current = true
    secondaryScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft
    requestAnimationFrame(() => {
      isScrollSyncing.current = false
    })
  }, [])

  const handleSecondaryScroll = useCallback(() => {
    if (isScrollSyncing.current) return
    if (!mainScrollRef.current || !secondaryScrollRef.current) return
    isScrollSyncing.current = true
    mainScrollRef.current.scrollLeft = secondaryScrollRef.current.scrollLeft
    requestAnimationFrame(() => {
      isScrollSyncing.current = false
    })
  }, [])

  const hasMainFile = !!store.mainFilePath
  const hasSecondaryFile = !!store.secondaryFilePath
  const hasMainPeaks = store.mainPeaks.length > 0
  const hasSecondaryPeaks = store.secondaryPeaks.length > 0
  const hasWaveforms = hasMainPeaks && hasSecondaryPeaks

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

  // Handle click on waveform area to set cursor position
  const handleWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!mainScrollRef.current) return

      const container = mainScrollRef.current
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
        if (!mainScrollRef.current || mainDuration <= 0) return

        const container = mainScrollRef.current
        const containerWidth = container.clientWidth

        const newMaxPeaks = Math.floor(2000 * newZoom)
        const newDisplayWidth = Math.min(store.mainPeaks.length, newMaxPeaks) * pixelsPerPeak
        const newPixelsPerSecond = mainDuration > 0 ? newDisplayWidth / mainDuration : 0

        const cursorPixels = (store.cursorPositionMs / 1000) * newPixelsPerSecond
        const newScrollLeft = cursorPixels - containerWidth / 2
        container.scrollLeft = newScrollLeft
        if (secondaryScrollRef.current) {
          secondaryScrollRef.current.scrollLeft = newScrollLeft
        }
      })
    },
    [mainDuration, store.mainPeaks.length, store.cursorPositionMs]
  )

  return (
    <div className={styles.container} ref={containerRef} tabIndex={0}>
      {/* Track Rows */}
      <div className={styles.tracksContainer}>
        {/* Main Track Row */}
        <TrackRow
          label="Main Video"
          color="#4ade80"
          filePath={store.mainFilePath}
          fileName={mainFileName}
          analysisStep={store.mainAnalysisStep}
          onSelectFile={onSelectMainFile}
          onFileDrop={onLoadMainFile}
          onClear={() => store.setMainFile('', [])}
          isMuted={store.isMainAudioMuted}
          onMuteToggle={store.toggleMainAudioMute}
          duration={mainDuration}
        >
          {hasMainPeaks ? (
            <div ref={mainScrollRef} className={styles.waveformScroll} onScroll={handleMainScroll}>
              <div
                className={styles.waveformContent}
                style={{ width: totalWidth || '100%' }}
                onClick={handleWaveformClick}
              >
                <TimelineCursor
                  positionMs={store.cursorPositionMs}
                  pixelsPerSecond={pixelsPerSecond}
                  baseOffset={mainStartOffset}
                />
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
              </div>
            </div>
          ) : store.mainAnalysisStep === 'pending' ? (
            <div className={styles.waveformPlaceholder}>
              <TrackSelector
                tracks={store.mainTracks}
                selectedIndex={store.selectedMainTrackIndex}
                onSelect={store.setSelectedMainTrack}
                onAnalyze={() => store.setMainAnalysisStep('extracting')}
              />
            </div>
          ) : hasMainFile ? (
            <div className={styles.waveformPlaceholder}>
              <AnalysisProgress step={store.mainAnalysisStep} />
            </div>
          ) : null}
        </TrackRow>

        {/* Secondary Track Row */}
        <TrackRow
          label="Audio Source"
          color="#e94560"
          filePath={store.secondaryFilePath}
          fileName={secondaryFileName}
          analysisStep={store.secondaryAnalysisStep}
          onSelectFile={onSelectSecondaryFile}
          onFileDrop={onLoadSecondaryFile}
          onClear={() => store.setSecondaryFile('', [])}
          isMuted={store.isSecondaryAudioMuted}
          onMuteToggle={store.toggleSecondaryAudioMute}
          duration={secondaryDuration}
        >
          {hasSecondaryPeaks ? (
            <div ref={secondaryScrollRef} className={styles.waveformScroll} onScroll={handleSecondaryScroll}>
              <div
                className={styles.waveformContent}
                style={{ width: totalWidth || '100%' }}
              >
                <TimelineCursor
                  positionMs={store.cursorPositionMs}
                  pixelsPerSecond={pixelsPerSecond}
                  baseOffset={mainStartOffset}
                />
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
              </div>
            </div>
          ) : store.secondaryAnalysisStep === 'pending' ? (
            <div className={styles.waveformPlaceholder}>
              <TrackSelector
                tracks={store.secondaryTracks}
                selectedIndex={store.selectedSecondaryTrackIndex}
                onSelect={store.setSelectedSecondaryTrack}
                onAnalyze={() => store.setSecondaryAnalysisStep('extracting')}
              />
            </div>
          ) : hasSecondaryFile ? (
            <div className={styles.waveformPlaceholder}>
              <AnalysisProgress step={store.secondaryAnalysisStep} />
            </div>
          ) : null}
        </TrackRow>
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
    </div>
  )
}
