import { useCallback, useState, useEffect, useRef } from 'react'
import { Upload, ChevronRight, Film, Check, CheckCircle, X, Volume2, Circle, AlertCircle } from 'lucide-react'
import { WaveformSpinner } from './WaveformSpinner'
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

function formatTrackInfo(track: AudioTrack): { title: string; details: string; duration: string } {
  // Title: Language uppercase or Track N fallback
  const title = track.language
    ? track.language.toUpperCase()
    : `Track ${track.index + 1}`

  // Details: Title - CODEC - Nch (dash separator)
  const parts: string[] = []
  if (track.title) parts.push(track.title)
  parts.push(track.codec.toUpperCase())
  parts.push(`${track.channels}ch`)

  // Duration formatted
  const mins = Math.floor(track.duration_seconds / 60)
  const secs = Math.floor(track.duration_seconds % 60)
  const duration = `${mins}:${secs.toString().padStart(2, '0')}`

  return {
    title,
    details: parts.join(' - '),
    duration
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
  const alignmentTriggeredRef = useRef(false)

  const currentStep = store.setupWizardStep
  const hasMainPeaks = store.mainPeaks.length > 0
  const hasSecondaryPeaks = store.secondaryPeaks.length > 0

  // Trigger alignment detection when both waveforms are ready
  useEffect(() => {
    if (
      currentStep === 'analyzing' &&
      hasMainPeaks &&
      hasSecondaryPeaks &&
      store.alignmentDetectionStep === 'idle' &&
      store.mainWavPath &&
      store.secondaryWavPath &&
      api.isReady &&
      !alignmentTriggeredRef.current
    ) {
      alignmentTriggeredRef.current = true
      store.setAlignmentDetectionStep('detecting')
      api
        .detectAlignment(store.mainWavPath, store.secondaryWavPath)
        .then((result) => {
          store.setOffset(result.offset_ms)
          store.setConfidence(result.confidence)
          store.setAlignmentDetectionStep('done')
        })
        .catch((err) => {
          store.setError(err instanceof Error ? err.message : 'Alignment detection failed')
          store.setAlignmentDetectionStep('error')
        })
    }
  }, [
    currentStep,
    hasMainPeaks,
    hasSecondaryPeaks,
    store.alignmentDetectionStep,
    store.mainWavPath,
    store.secondaryWavPath,
    api.isReady,
    api,
    store
  ])

  // Reset alignment triggered ref when going back
  useEffect(() => {
    if (currentStep !== 'analyzing') {
      alignmentTriggeredRef.current = false
    }
  }, [currentStep])

  const handleBack = useCallback(() => {
    if (currentStep === 'analyzing') {
      // Go back to files-tracks and reset all analysis state
      store.setMainAnalysisStep('pending')
      store.setSecondaryAnalysisStep('pending')
      store.setAlignmentDetectionStep('idle')
      store.setMainWavPath(null)
      store.setSecondaryWavPath(null)
      store.setMainPeaks([])
      store.setSecondaryPeaks([])
      store.setOffset(0)
      store.setConfidence(0)
      store.setSetupWizardStep('files-tracks')
    }
  }, [currentStep, store])

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
    store.setMainFile('', [])
  }, [store])

  const handleClearSecondaryFile = useCallback(() => {
    store.setSecondaryFile('', [])
  }, [store])

  const handleStartAnalysis = useCallback(() => {
    store.setSetupWizardStep('analyzing')
    store.setMainAnalysisStep('extracting')
    store.setSecondaryAnalysisStep('extracting')
  }, [store])

  // Check step completion
  const hasMainFile = !!store.mainFilePath
  const hasSecondaryFile = !!store.secondaryFilePath
  const hasMainTracks = store.mainTracks.length > 0
  const hasSecondaryTracks = store.secondaryTracks.length > 0

  // Auto-advance logic
  const canProceedFromFiles = hasMainFile && hasMainTracks && hasSecondaryFile && hasSecondaryTracks

  // Task completion states for analyze step
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
  const alignmentFailed = store.alignmentDetectionStep === 'error'
  const allAnalysisDone = waveformDone && alignmentDone

  // Task active states (currently running)
  const extractActive =
    store.mainAnalysisStep === 'extracting' || store.secondaryAnalysisStep === 'extracting'
  const waveformActive =
    extractDone && !waveformDone &&
    (store.mainAnalysisStep === 'waveform' || store.secondaryAnalysisStep === 'waveform')
  const alignmentActive =
    waveformDone && !alignmentDone && store.alignmentDetectionStep === 'detecting'

  // Determine step states for indicators
  const isFilesComplete = hasMainFile && hasSecondaryFile
  const isTracksComplete = currentStep === 'analyzing' || allAnalysisDone
  const isAnalyzeComplete = allAnalysisDone

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Step indicators */}
        <div className={styles.steps}>
          <div
            className={`${styles.step} ${currentStep === 'files-tracks' ? styles.active : ''} ${isFilesComplete && isTracksComplete ? styles.completed : ''}`}
          >
            <span className={styles.stepLabel}>Files & Tracks</span>
          </div>
          <ChevronRight size={16} className={styles.stepArrow} />
          <div
            className={`${styles.step} ${currentStep === 'analyzing' ? styles.active : ''} ${isAnalyzeComplete ? styles.completed : ''}`}
          >
            <span className={styles.stepLabel}>Analyze</span>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {currentStep === 'files-tracks' && (
            <div className={styles.stepContent}>
              <div className={styles.fileSelectors}>
                {/* Main Video Column */}
                <div className={styles.fileSelector}>
                  {/* File Selection */}
                  <div className={styles.fileSelectorHeader}>
                    <Film size={20} className={styles.fileSelectorIcon} />
                    <span className={styles.fileSelectorLabel}>Main Video</span>
                  </div>
                  {hasMainFile ? (
                    <div className={styles.selectedFile}>
                      <span className={styles.fileName}>
                        {store.mainFilePath?.split('/').pop()}
                      </span>
                      <button className={styles.removeButton} onClick={handleClearMainFile}>
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

                  {/* Track Selection */}
                  <div className={`${styles.fileSelectorHeader} ${styles.trackHeader}`}>
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
                            onClick={() => store.setSelectedMainTrack(track.index)}
                          >
                            <span className={styles.radioButton}>
                              {store.selectedMainTrackIndex === track.index && <span className={styles.radioButtonDot} />}
                            </span>
                            <span className={styles.trackTileContent}>
                              <span className={styles.trackTileHeader}>{info.title}</span>
                              <span className={styles.trackTileDescription}>{info.details}</span>
                            </span>
                            <span className={styles.trackTileDuration}>{info.duration}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className={styles.trackPlaceholder} />
                  )}
                </div>

                {/* Second Video Column */}
                <div className={styles.fileSelector}>
                  {/* File Selection */}
                  <div className={styles.fileSelectorHeader}>
                    <Film size={20} className={styles.fileSelectorIcon} />
                    <span className={styles.fileSelectorLabel}>Second Video</span>
                  </div>
                  {hasSecondaryFile ? (
                    <div className={styles.selectedFile}>
                      <span className={styles.fileName}>
                        {store.secondaryFilePath?.split('/').pop()}
                      </span>
                      <button className={styles.removeButton} onClick={handleClearSecondaryFile}>
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

                  {/* Track Selection */}
                  <div className={`${styles.fileSelectorHeader} ${styles.trackHeader}`}>
                    <Volume2 size={20} className={styles.fileSelectorIcon} />
                    <span className={styles.fileSelectorLabel}>Second Audio</span>
                  </div>
                  {hasSecondaryFile && hasSecondaryTracks ? (
                    <div className={styles.trackTiles}>
                      {store.secondaryTracks.map((track) => {
                        const info = formatTrackInfo(track)
                        return (
                          <button
                            key={track.index}
                            className={`${styles.trackTile} ${store.selectedSecondaryTrackIndex === track.index ? styles.trackTileSelected : ''}`}
                            onClick={() => store.setSelectedSecondaryTrack(track.index)}
                          >
                            <span className={styles.radioButton}>
                              {store.selectedSecondaryTrackIndex === track.index && <span className={styles.radioButtonDot} />}
                            </span>
                            <span className={styles.trackTileContent}>
                              <span className={styles.trackTileHeader}>{info.title}</span>
                              <span className={styles.trackTileDescription}>{info.details}</span>
                            </span>
                            <span className={styles.trackTileDuration}>{info.duration}</span>
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
          )}

          {currentStep === 'analyzing' && (
            <div className={styles.stepContent}>
              <div className={styles.analyzeContent}>
                {/* Spinner or Success Icon */}
                <div className={styles.spinnerContainer}>
                  {allAnalysisDone ? (
                    <Check size={48} className={styles.successIcon} />
                  ) : (
                    <WaveformSpinner size="lg" />
                  )}
                </div>

                {/* Task List */}
                <ul className={styles.taskList}>
                  <li className={`${styles.taskItem} ${extractDone ? styles.completed : ''} ${extractActive ? styles.active : ''}`}>
                    {extractDone ? (
                      <CheckCircle size={18} className={styles.taskCheckIcon} />
                    ) : (
                      <Circle size={18} className={styles.taskPendingIcon} />
                    )}
                    <span>Extracting audio</span>
                  </li>
                  <li className={`${styles.taskItem} ${waveformDone ? styles.completed : ''} ${waveformActive ? styles.active : ''}`}>
                    {waveformDone ? (
                      <CheckCircle size={18} className={styles.taskCheckIcon} />
                    ) : (
                      <Circle size={18} className={styles.taskPendingIcon} />
                    )}
                    <span>Generating waveforms</span>
                  </li>
                  <li
                    className={`${styles.taskItem} ${alignmentDone ? styles.completed : ''} ${alignmentFailed ? styles.failed : ''} ${alignmentActive ? styles.active : ''}`}
                  >
                    {alignmentDone ? (
                      alignmentFailed ? (
                        <AlertCircle size={18} className={styles.taskErrorIcon} />
                      ) : (
                        <CheckCircle size={18} className={styles.taskCheckIcon} />
                      )
                    ) : (
                      <Circle size={18} className={styles.taskPendingIcon} />
                    )}
                    <span>
                      Guessing audio wave offset
                      {alignmentFailed && ' (failed)'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {currentStep === 'analyzing' && (
            <button className={styles.backButton} onClick={handleBack}>
              Back
            </button>
          )}
          <div className={styles.spacer} />
          {currentStep === 'files-tracks' && (
            <button
              className={styles.continueButton}
              onClick={handleStartAnalysis}
              disabled={!canProceedFromFiles}
            >
              Continue
            </button>
          )}
          {currentStep === 'analyzing' && (
            <button
              className={styles.continueButton}
              onClick={() => store.setShowSetupWizard(false)}
              disabled={!allAnalysisDone}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
