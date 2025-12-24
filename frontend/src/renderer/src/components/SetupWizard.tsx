import { useCallback, useState, useEffect } from 'react'
import { Upload, FolderOpen, ChevronRight, X, Film, Music, Check, Loader2 } from 'lucide-react'
import { useProjectStore } from '../stores/projectStore'
import type { AudioTrack, AnalysisStep } from '../types'
import styles from './SetupWizard.module.css'

interface SetupWizardProps {
  onSelectMainFile: () => Promise<void>
  onSelectSecondaryFile: () => Promise<void>
  onLoadMainFile: (path: string) => void
  onLoadSecondaryFile: (path: string) => void
}

function formatTrackLabel(track: AudioTrack): string {
  const parts = [`Track ${track.index + 1}`]
  if (track.language) parts.push(track.language)
  parts.push(track.codec)
  parts.push(`${track.channels}ch`)
  if (track.title) parts.push(`- ${track.title}`)
  return parts.join(' • ')
}

interface AnalysisProgressProps {
  label: string
  color: string
  step: AnalysisStep
  hasPeaks: boolean
}

function AnalysisProgress({ label, color, step, hasPeaks }: AnalysisProgressProps) {
  const isComplete = hasPeaks
  const isActive = step !== 'idle' && step !== 'pending' && !isComplete

  const getStatusText = () => {
    if (isComplete) return 'Complete'
    if (step === 'extracting') return 'Extracting audio...'
    if (step === 'waveform') return 'Generating waveform...'
    return 'Waiting...'
  }

  return (
    <div className={styles.analysisItem}>
      <div className={styles.analysisHeader}>
        <span className={styles.colorDot} style={{ backgroundColor: color }} />
        <span className={styles.analysisLabel}>{label}</span>
        {isComplete ? (
          <Check size={16} className={styles.checkIcon} />
        ) : isActive ? (
          <Loader2 size={16} className={styles.spinnerIcon} />
        ) : null}
      </div>
      <div className={styles.analysisStatus}>
        <span className={`${styles.statusText} ${isComplete ? styles.complete : ''}`}>
          {getStatusText()}
        </span>
      </div>
      {isActive && (
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} />
          </div>
        </div>
      )}
    </div>
  )
}

export function SetupWizard({
  onSelectMainFile,
  onSelectSecondaryFile,
  onLoadMainFile,
  onLoadSecondaryFile
}: SetupWizardProps) {
  const store = useProjectStore()
  const [isDragOver, setIsDragOver] = useState(false)

  const currentStep = store.setupWizardStep

  // Auto-close wizard when both waveforms are ready
  useEffect(() => {
    if (currentStep === 'analyzing') {
      const hasMainPeaks = store.mainPeaks.length > 0
      const hasSecondaryPeaks = store.secondaryPeaks.length > 0
      if (hasMainPeaks && hasSecondaryPeaks) {
        store.setShowSetupWizard(false)
      }
    }
  }, [currentStep, store.mainPeaks.length, store.secondaryPeaks.length, store])

  const handleClose = useCallback(() => {
    // Don't allow closing during analysis
    if (currentStep === 'analyzing') return
    store.setShowSetupWizard(false)
  }, [currentStep, store])

  const handleBack = useCallback(() => {
    if (currentStep === 'audio-source') {
      store.setSetupWizardStep('main-video')
    } else if (currentStep === 'track-selection') {
      store.setSetupWizardStep('audio-source')
    }
  }, [currentStep, store])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, onLoad: (path: string) => void) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

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
  const hasMainPeaks = store.mainPeaks.length > 0
  const hasSecondaryPeaks = store.secondaryPeaks.length > 0

  // Auto-advance logic
  const canProceedFromMain = hasMainFile && hasMainTracks
  const canProceedFromSecondary = hasSecondaryFile && hasSecondaryTracks

  // Determine step states for indicators
  const isStep1Complete = hasMainFile
  const isStep2Complete = hasSecondaryFile
  const isStep3Complete = currentStep === 'analyzing' || (hasMainPeaks && hasSecondaryPeaks)
  const isStep4Complete = hasMainPeaks && hasSecondaryPeaks

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Setup Your Project</h2>
          {currentStep !== 'analyzing' && (
            <button className={styles.closeButton} onClick={handleClose} title="Close">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Step indicators */}
        <div className={styles.steps}>
          <div
            className={`${styles.step} ${currentStep === 'main-video' ? styles.active : ''} ${isStep1Complete ? styles.completed : ''}`}
          >
            <span className={styles.stepNumber}>
              {isStep1Complete ? <Check size={12} /> : '1'}
            </span>
            <span className={styles.stepLabel}>Main Video</span>
          </div>
          <ChevronRight size={16} className={styles.stepArrow} />
          <div
            className={`${styles.step} ${currentStep === 'audio-source' ? styles.active : ''} ${isStep2Complete ? styles.completed : ''}`}
          >
            <span className={styles.stepNumber}>
              {isStep2Complete ? <Check size={12} /> : '2'}
            </span>
            <span className={styles.stepLabel}>Audio Source</span>
          </div>
          <ChevronRight size={16} className={styles.stepArrow} />
          <div
            className={`${styles.step} ${currentStep === 'track-selection' ? styles.active : ''} ${isStep3Complete ? styles.completed : ''}`}
          >
            <span className={styles.stepNumber}>
              {isStep3Complete ? <Check size={12} /> : '3'}
            </span>
            <span className={styles.stepLabel}>Tracks</span>
          </div>
          <ChevronRight size={16} className={styles.stepArrow} />
          <div
            className={`${styles.step} ${currentStep === 'analyzing' ? styles.active : ''} ${isStep4Complete ? styles.completed : ''}`}
          >
            <span className={styles.stepNumber}>
              {isStep4Complete ? <Check size={12} /> : '4'}
            </span>
            <span className={styles.stepLabel}>Analyze</span>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {currentStep === 'main-video' && (
            <div className={styles.stepContent}>
              <Film size={48} className={styles.icon} />
              <h3 className={styles.stepTitle}>Select Main Video</h3>
              <p className={styles.stepDescription}>
                Choose the video you want to add audio to.
                <br />
                The new audio track will be merged into this file.
              </p>
              {hasMainFile ? (
                <div className={styles.selectedFile}>
                  <Check size={16} className={styles.checkIcon} />
                  <span className={styles.fileName}>
                    {store.mainFilePath?.split('/').pop()}
                  </span>
                </div>
              ) : (
                <div
                  className={`${styles.dropZone} ${isDragOver ? styles.dragOver : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, onLoadMainFile)}
                >
                  <Upload size={24} className={styles.uploadIcon} />
                  <span>Drag & drop video file here</span>
                  <span className={styles.orText}>or</span>
                  <button className={styles.browseButton} onClick={handleMainFileSelect}>
                    <FolderOpen size={14} />
                    Browse Files
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === 'audio-source' && (
            <div className={styles.stepContent}>
              <Music size={48} className={styles.icon} />
              <h3 className={styles.stepTitle}>Select Audio Source</h3>
              <p className={styles.stepDescription}>
                Choose the video with the audio you want to add.
                <br />
                This audio will be extracted and merged.
              </p>
              {hasSecondaryFile ? (
                <div className={styles.selectedFile}>
                  <Check size={16} className={styles.checkIcon} />
                  <span className={styles.fileName}>
                    {store.secondaryFilePath?.split('/').pop()}
                  </span>
                </div>
              ) : (
                <div
                  className={`${styles.dropZone} ${isDragOver ? styles.dragOver : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, onLoadSecondaryFile)}
                >
                  <Upload size={24} className={styles.uploadIcon} />
                  <span>Drag & drop video file here</span>
                  <span className={styles.orText}>or</span>
                  <button className={styles.browseButton} onClick={handleSecondaryFileSelect}>
                    <FolderOpen size={14} />
                    Browse Files
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === 'track-selection' && (
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Select Audio Tracks</h3>
              <p className={styles.stepDescription}>
                Choose which audio tracks to use from each file.
              </p>

              <div className={styles.trackSelectors}>
                <div className={styles.trackSelector}>
                  <label className={styles.trackSelectorLabel}>
                    <span className={styles.colorDot} style={{ backgroundColor: '#4ade80' }} />
                    Main Video Audio:
                  </label>
                  <select
                    className={styles.trackDropdown}
                    value={store.selectedMainTrackIndex}
                    onChange={(e) => store.setSelectedMainTrack(Number(e.target.value))}
                  >
                    {store.mainTracks.map((track) => (
                      <option key={track.index} value={track.index}>
                        {formatTrackLabel(track)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.trackSelector}>
                  <label className={styles.trackSelectorLabel}>
                    <span className={styles.colorDot} style={{ backgroundColor: '#e94560' }} />
                    Audio Source:
                  </label>
                  <select
                    className={styles.trackDropdown}
                    value={store.selectedSecondaryTrackIndex}
                    onChange={(e) => store.setSelectedSecondaryTrack(Number(e.target.value))}
                  >
                    {store.secondaryTracks.map((track) => (
                      <option key={track.index} value={track.index}>
                        {formatTrackLabel(track)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'analyzing' && (
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Analyzing Audio</h3>
              <p className={styles.stepDescription}>
                Extracting and analyzing audio tracks...
              </p>

              <div className={styles.analysisContainer}>
                <AnalysisProgress
                  label="Main Video"
                  color="#4ade80"
                  step={store.mainAnalysisStep}
                  hasPeaks={hasMainPeaks}
                />
                <AnalysisProgress
                  label="Audio Source"
                  color="#e94560"
                  step={store.secondaryAnalysisStep}
                  hasPeaks={hasSecondaryPeaks}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {currentStep !== 'main-video' && currentStep !== 'analyzing' && (
            <button className={styles.backButton} onClick={handleBack}>
              Back
            </button>
          )}
          <div className={styles.spacer} />
          {currentStep === 'main-video' && (
            <button
              className={styles.continueButton}
              onClick={() => store.setSetupWizardStep('audio-source')}
              disabled={!canProceedFromMain}
            >
              Continue
            </button>
          )}
          {currentStep === 'audio-source' && (
            <button
              className={styles.continueButton}
              onClick={() => store.setSetupWizardStep('track-selection')}
              disabled={!canProceedFromSecondary}
            >
              Continue
            </button>
          )}
          {currentStep === 'track-selection' && (
            <button className={styles.startButton} onClick={handleStartAnalysis}>
              Start Analysis
            </button>
          )}
          {currentStep === 'analyzing' && (
            <div className={styles.analyzingHint}>
              Please wait while audio is being analyzed...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
