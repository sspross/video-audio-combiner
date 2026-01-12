import { useCallback, useState, useEffect, useRef } from 'react'
import { Upload, ChevronRight, Film, X, Volume2 } from 'lucide-react'
import { WaveformSpinner } from './WaveformSpinner'
import { WizardSteps, WizardHeader, WizardFooter, WizardButton, WIZARD_STEPS } from './wizard'
import { useProjectStore } from '../stores/projectStore'
import { useBackendApi } from '../hooks/useBackendApi'
import type { AudioTrack } from '../types'
import styles from './SetupWizard.module.css'

interface SetupWizardProps {
  onSelectMainFile: () => Promise<void>
  onSelectSecondaryFile: () => Promise<void>
  onLoadMainFile: (path: string) => void
  onLoadSecondaryFile: (path: string) => void
}

function formatTrackInfo(track: AudioTrack): { title: string; details: string } {
  // Title: Language uppercase or Track N fallback
  const title = track.language
    ? track.language.toUpperCase()
    : `Track ${track.index + 1}`

  // Details: Title - CODEC - Nch - Duration (dash separator)
  const parts: string[] = []
  if (track.title) parts.push(track.title)
  parts.push(track.codec.toUpperCase())
  parts.push(`${track.channels}ch`)

  // Duration formatted
  const mins = Math.floor(track.duration_seconds / 60)
  const secs = Math.floor(track.duration_seconds % 60)
  parts.push(`${mins}:${secs.toString().padStart(2, '0')}`)

  return {
    title,
    details: parts.join(' - ')
  }
}

export function SetupWizard({
  onSelectMainFile,
  onSelectSecondaryFile,
  onLoadMainFile,
  onLoadSecondaryFile
}: SetupWizardProps) {
  const store = useProjectStore()
  const api = useBackendApi()
  const [isDragOverMain, setIsDragOverMain] = useState(false)
  const [isDragOverSecondary, setIsDragOverSecondary] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')
  const alignmentTriggeredRef = useRef(false)

  const hasMainPeaks = store.mainPeaks.length > 0
  const hasSecondaryPeaks = store.secondaryPeaks.length > 0

  // Track analysis progress and update status message
  const extractDone =
    store.mainAnalysisStep !== 'extracting' &&
    store.secondaryAnalysisStep !== 'extracting' &&
    (store.mainAnalysisStep === 'waveform' ||
      store.mainAnalysisStep === 'idle' ||
      hasMainPeaks) &&
    (store.secondaryAnalysisStep === 'waveform' ||
      store.secondaryAnalysisStep === 'idle' ||
      hasSecondaryPeaks)
  const waveformDone = hasMainPeaks && hasSecondaryPeaks
  const alignmentDone =
    store.alignmentDetectionStep === 'done' || store.alignmentDetectionStep === 'error'
  const allAnalysisDone = waveformDone && alignmentDone

  // Update status message based on analysis progress
  useEffect(() => {
    if (!isAnalyzing) return

    if (!extractDone) {
      setAnalysisStatus('Extracting audio...')
    } else if (!waveformDone) {
      setAnalysisStatus('Generating waveforms...')
    } else if (!alignmentDone) {
      setAnalysisStatus('Detecting alignment...')
    }
  }, [isAnalyzing, extractDone, waveformDone, alignmentDone])

  // Trigger alignment detection when both waveforms are ready
  useEffect(() => {
    if (
      isAnalyzing &&
      hasMainPeaks &&
      hasSecondaryPeaks &&
      store.alignmentDetectionStep === 'idle' &&
      store.mainWavPath &&
      store.secondaryWavPath &&
      api.isReady &&
      !alignmentTriggeredRef.current
    ) {
      alignmentTriggeredRef.current = true
      const version = store.analysisVersion
      store.setAlignmentDetectionStep('detecting')
      api
        .detectAlignment(store.mainWavPath, store.secondaryWavPath)
        .then((result) => {
          if (store.analysisVersion !== version) return
          store.setOffset(result.offset_ms)
          store.setConfidence(result.confidence)
          store.setAlignmentDetectionStep('done')
        })
        .catch((err) => {
          if (store.analysisVersion !== version) return
          store.setError(err instanceof Error ? err.message : 'Alignment detection failed')
          store.setAlignmentDetectionStep('error')
        })
    }
  }, [
    isAnalyzing,
    hasMainPeaks,
    hasSecondaryPeaks,
    store.alignmentDetectionStep,
    store.mainWavPath,
    store.secondaryWavPath,
    api.isReady,
    api,
    store
  ])

  // Auto-transition to edit screen when analysis completes
  useEffect(() => {
    if (isAnalyzing && allAnalysisDone) {
      // Calculate middle of video
      const mainTrack = store.mainTracks[store.selectedMainTrackIndex]
      const durationMs = (mainTrack?.duration_seconds || 0) * 1000
      const middleMs = durationMs / 2

      // Set cursor and preview to middle of video
      store.setCursorPosition(middleMs)
      store.setPreviewStartTime(middleMs)

      // Hide wizard to show editor
      store.setShowSetupWizard(false)
    }
  }, [isAnalyzing, allAnalysisDone, store])

  const handleDrop = useCallback(
    (e: React.DragEvent, onLoad: (path: string) => void, setDragOver: (v: boolean) => void) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const path = window.electron.getPathForFile(files[0])
        if (path) {
          onLoad(path)
        }
      }
    },
    []
  )

  const handleMainFileSelect = useCallback(async () => {
    await onSelectMainFile()
  }, [onSelectMainFile])

  const handleSecondaryFileSelect = useCallback(async () => {
    await onSelectSecondaryFile()
  }, [onSelectSecondaryFile])

  const handleClearMainFile = useCallback(() => {
    store.setMainFile('', [], null)
  }, [store])

  const handleClearSecondaryFile = useCallback(() => {
    store.setSecondaryFile('', [], null)
  }, [store])

  // Reset analysis state helper
  const resetAnalysisState = useCallback(() => {
    store.incrementAnalysisVersion()
    store.setMainAnalysisStep('pending')
    store.setSecondaryAnalysisStep('pending')
    store.setAlignmentDetectionStep('idle')
    store.setMainWavPath(null)
    store.setSecondaryWavPath(null)
    store.setMainPeaks([])
    store.setSecondaryPeaks([])
    store.setOffset(0)
    store.setConfidence(0)
  }, [store])

  // Handle track selection changes - reset analysis when track changes
  const handleMainTrackSelect = useCallback((index: number) => {
    if (index !== store.selectedMainTrackIndex) {
      resetAnalysisState()
    }
    store.setSelectedMainTrack(index)
  }, [store, resetAnalysisState])

  const handleSecondaryTrackSelect = useCallback((index: number) => {
    if (index !== store.selectedSecondaryTrackIndex) {
      resetAnalysisState()
    }
    store.setSelectedSecondaryTrack(index)
  }, [store, resetAnalysisState])

  const handleContinue = useCallback(() => {
    // If analysis already done, go directly to edit screen
    if (allAnalysisDone) {
      const mainTrack = store.mainTracks[store.selectedMainTrackIndex]
      const durationMs = (mainTrack?.duration_seconds || 0) * 1000
      const middleMs = durationMs / 2
      store.setCursorPosition(middleMs)
      store.setPreviewStartTime(middleMs)
      store.setShowSetupWizard(false)
      return
    }

    // Otherwise, start analysis
    setIsAnalyzing(true)
    alignmentTriggeredRef.current = false
    store.setMainAnalysisStep('extracting')
    store.setSecondaryAnalysisStep('extracting')
  }, [store, allAnalysisDone])

  // Check step completion
  const hasMainFile = !!store.mainFilePath
  const hasSecondaryFile = !!store.secondaryFilePath
  const hasMainTracks = store.mainTracks.length > 0
  const hasSecondaryTracks = store.secondaryTracks.length > 0

  const canProceedFromFiles = hasMainFile && hasMainTracks && hasSecondaryFile && hasSecondaryTracks

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header with steps */}
        <WizardHeader>
          <WizardSteps
            steps={[...WIZARD_STEPS]}
            currentStep="files-tracks"
            completedSteps={[]}
          />
        </WizardHeader>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.stepContent}>
            <div className={styles.gridLayout}>
              {/* Row 1: Main Video | Arrow | Main Audio */}
              <div className={styles.gridItem}>
                <div className={styles.fileSelectorHeader}>
                  <Film size={20} className={styles.fileSelectorIcon} />
                  <span className={styles.fileSelectorLabel}>Main Video</span>
                </div>
                {hasMainFile ? (
                  <div className={styles.selectedFile}>
                    <span className={styles.fileName}>
                      {store.mainFilePath?.split('/').pop()}
                    </span>
                    <button className={styles.removeButton} onClick={handleClearMainFile} disabled={isAnalyzing}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`${styles.dropZone} ${isDragOverMain ? styles.dragOver : ''}`}
                    onClick={handleMainFileSelect}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOverMain(true) }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOverMain(false) }}
                    onDrop={(e) => handleDrop(e, onLoadMainFile, setIsDragOverMain)}
                  >
                    <Upload size={20} className={styles.uploadIcon} />
                    <span className={styles.dropZoneText}>Browse</span>
                  </div>
                )}
              </div>

              <div className={styles.gridArrow}>
                <ChevronRight size={20} />
              </div>

              <div className={styles.gridItem}>
                <div className={styles.fileSelectorHeader}>
                  <Volume2 size={20} className={styles.fileSelectorIcon} />
                  <span className={styles.fileSelectorLabel}>Main Audio</span>
                </div>
                {hasMainFile && hasMainTracks ? (
                  <div className={styles.trackTiles}>
                    {store.mainTracks.map((track) => {
                      const info = formatTrackInfo(track)
                      return (
                        <button
                          key={track.index}
                          className={`${styles.trackTile} ${store.selectedMainTrackIndex === track.index ? styles.trackTileSelected : ''}`}
                          onClick={() => handleMainTrackSelect(track.index)}
                          disabled={isAnalyzing}
                        >
                          <span className={styles.radioButton}>
                            {store.selectedMainTrackIndex === track.index && <span className={styles.radioButtonDot} />}
                          </span>
                          <span className={styles.trackTileContent}>
                            <span className={styles.trackTileHeader}>{info.title}</span>
                            <span className={styles.trackTileDescription}>{info.details}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className={styles.trackPlaceholder} />
                )}
              </div>

              {/* Row 2: Second Video | Arrow | Audio to Align and Add */}
              <div className={styles.gridItem}>
                <div className={styles.fileSelectorHeader}>
                  <Film size={20} className={styles.fileSelectorIcon} />
                  <span className={styles.fileSelectorLabel}>Second Video</span>
                </div>
                {hasSecondaryFile ? (
                  <div className={styles.selectedFile}>
                    <span className={styles.fileName}>
                      {store.secondaryFilePath?.split('/').pop()}
                    </span>
                    <button className={styles.removeButton} onClick={handleClearSecondaryFile} disabled={isAnalyzing}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`${styles.dropZone} ${isDragOverSecondary ? styles.dragOver : ''}`}
                    onClick={handleSecondaryFileSelect}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOverSecondary(true) }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOverSecondary(false) }}
                    onDrop={(e) => handleDrop(e, onLoadSecondaryFile, setIsDragOverSecondary)}
                  >
                    <Upload size={20} className={styles.uploadIcon} />
                    <span className={styles.dropZoneText}>Browse</span>
                  </div>
                )}
              </div>

              <div className={styles.gridArrow}>
                <ChevronRight size={20} />
              </div>

              <div className={styles.gridItem}>
                <div className={styles.fileSelectorHeader}>
                  <Volume2 size={20} className={styles.fileSelectorIcon} />
                  <span className={styles.fileSelectorLabel}>Audio to Align and Add</span>
                </div>
                {hasSecondaryFile && hasSecondaryTracks ? (
                  <div className={styles.trackTiles}>
                    {store.secondaryTracks.map((track) => {
                      const info = formatTrackInfo(track)
                      return (
                        <button
                          key={track.index}
                          className={`${styles.trackTile} ${store.selectedSecondaryTrackIndex === track.index ? styles.trackTileSelected : ''}`}
                          onClick={() => handleSecondaryTrackSelect(track.index)}
                          disabled={isAnalyzing}
                        >
                          <span className={styles.radioButton}>
                            {store.selectedSecondaryTrackIndex === track.index && <span className={styles.radioButtonDot} />}
                          </span>
                          <span className={styles.trackTileContent}>
                            <span className={styles.trackTileHeader}>{info.title}</span>
                            <span className={styles.trackTileDescription}>{info.details}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className={styles.trackPlaceholder} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <WizardFooter
          rightContent={
            <>
              {isAnalyzing && (
                <span className={styles.analysisStatus}>{analysisStatus}</span>
              )}
              <WizardButton
                onClick={handleContinue}
                disabled={!canProceedFromFiles || isAnalyzing}
              >
                {isAnalyzing && <WaveformSpinner size="sm" className={styles.buttonSpinner} />}
                Continue
              </WizardButton>
            </>
          }
        />
      </div>
    </div>
  )
}
