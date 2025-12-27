import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Check, CheckCircle, Circle, AlertCircle, FolderOpen, Music } from 'lucide-react'
import { WaveformSpinner } from './WaveformSpinner'
import { useProjectStore } from '../stores/projectStore'
import { useBackendApi } from '../hooks/useBackendApi'
import type { ExportMode } from '../types'
import styles from './ExportModal.module.css'

// Format duration in mm:ss or hh:mm:ss
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Format offset in ms to readable string
function formatOffset(offsetMs: number): string {
  const absMs = Math.abs(offsetMs)
  const sign = offsetMs >= 0 ? '+' : '-'
  const seconds = absMs / 1000
  if (seconds < 1) {
    return `${sign}${absMs.toFixed(0)}ms`
  }
  return `${sign}${seconds.toFixed(2)}s`
}

// ISO 639-2 language codes commonly used in media (sorted alphabetically by label)
const LANGUAGE_OPTIONS = [
  { code: 'ara', label: 'Arabic' },
  { code: 'zho', label: 'Chinese' },
  { code: 'dan', label: 'Danish' },
  { code: 'dut', label: 'Dutch' },
  { code: 'eng', label: 'English' },
  { code: 'fin', label: 'Finnish' },
  { code: 'fra', label: 'French' },
  { code: 'ger', label: 'German' },
  { code: 'hin', label: 'Hindi' },
  { code: 'ita', label: 'Italian' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'kor', label: 'Korean' },
  { code: 'nor', label: 'Norwegian' },
  { code: 'pol', label: 'Polish' },
  { code: 'por', label: 'Portuguese' },
  { code: 'rus', label: 'Russian' },
  { code: 'spa', label: 'Spanish' },
  { code: 'swe', label: 'Swedish' },
  { code: 'tha', label: 'Thai' },
  { code: 'tur', label: 'Turkish' },
  { code: 'vie', label: 'Vietnamese' },
  { code: 'und', label: 'Undefined' },
]

// Special value for custom language input
const OTHER_LANGUAGE = 'other'

// Helper to get language label from code
function getLanguageLabel(code: string): string {
  const lang = LANGUAGE_OPTIONS.find((l) => l.code === code.toLowerCase())
  return lang?.label || code.toUpperCase()
}

interface ExportModalProps {
  onRequestSavePath: (defaultName: string, extension: string) => Promise<string | null>
}

export function ExportModal({ onRequestSavePath }: ExportModalProps) {
  const store = useProjectStore()
  const api = useBackendApi()

  const exportStep = store.exportStep
  const exportMode = store.exportMode
  const exportLanguage = store.exportLanguage
  const exportTitle = store.exportTitle
  const exportError = store.exportError

  // Local state for "Other" language mode
  const [isOtherLanguage, setIsOtherLanguage] = useState(false)
  const [customLanguageCode, setCustomLanguageCode] = useState('')

  // Initialize language and title from secondary track when opening
  useEffect(() => {
    if (store.showExportModal && !exportLanguage) {
      const secondaryTrack = store.secondaryTracks[store.selectedSecondaryTrackIndex]
      let langCode = 'und'

      if (secondaryTrack?.language) {
        // Try to match the language code, default to 'und' if not found
        const trackLang = secondaryTrack.language.toLowerCase()
        const matchedLang = LANGUAGE_OPTIONS.find((l) => l.code === trackLang)
        if (matchedLang) {
          langCode = matchedLang.code
        } else {
          // Custom language code not in the list
          setIsOtherLanguage(true)
          setCustomLanguageCode(trackLang)
          langCode = trackLang
        }
      }

      store.setExportLanguage(langCode)
      // Prefill title with language name
      store.setExportTitle(getLanguageLabel(langCode))
    }
  }, [store.showExportModal, exportLanguage, store.secondaryTracks, store.selectedSecondaryTrackIndex, store])

  // Reset local state when modal closes
  useEffect(() => {
    if (!store.showExportModal) {
      setIsOtherLanguage(false)
      setCustomLanguageCode('')
    }
  }, [store.showExportModal])

  const handleBack = useCallback(() => {
    if (exportStep === 'options') {
      store.resetExportModal()
    }
  }, [exportStep, store])

  const handleExport = useCallback(async () => {
    if (!store.mainFilePath || !store.secondaryWavPath || !api.isReady) return

    const mainFileName = store.mainFilePath.split('/').pop() || 'output'
    const extension = mainFileName.split('.').pop() || 'mkv'
    const baseName = mainFileName.replace(`.${extension}`, '')

    let outputPath: string | null = null

    if (exportMode === 'create-new') {
      // Ask user for output path
      outputPath = await onRequestSavePath(`${baseName}_merged.${extension}`, extension)
      if (!outputPath) return
    } else {
      // For add-to-original mode, we'll use the original file path
      // The backend will handle creating a temp file and replacing
      outputPath = store.mainFilePath
    }

    store.setExportStep('exporting')
    store.setExportError(null)

    try {
      const result = await api.mergeAudio(
        store.mainFilePath,
        store.secondaryWavPath,
        store.offsetMs,
        outputPath,
        exportLanguage.toLowerCase() || 'und',
        exportTitle || undefined,
        exportMode === 'add-to-original'
      )

      if (result.success) {
        store.setExportStep('done')
      } else {
        store.setExportStep('error')
        store.setExportError('Export failed')
      }
    } catch (err) {
      store.setExportStep('error')
      store.setExportError(err instanceof Error ? err.message : 'Export failed')
    }
  }, [
    store.mainFilePath,
    store.secondaryWavPath,
    store.offsetMs,
    exportMode,
    exportLanguage,
    exportTitle,
    api.isReady,
    api,
    store,
    onRequestSavePath
  ])

  const handleDone = useCallback(() => {
    store.resetExportModal()
  }, [store])

  const handleModeChange = useCallback(
    (mode: ExportMode) => {
      store.setExportMode(mode)
    },
    [store]
  )

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value
      if (value === OTHER_LANGUAGE) {
        setIsOtherLanguage(true)
        setCustomLanguageCode('')
        store.setExportLanguage('')
        store.setExportTitle('')
      } else {
        setIsOtherLanguage(false)
        store.setExportLanguage(value)
        // Update title with language name
        store.setExportTitle(getLanguageLabel(value))
      }
    },
    [store]
  )

  const handleCustomLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const code = e.target.value.toLowerCase().slice(0, 3)
      setCustomLanguageCode(code)
      store.setExportLanguage(code)
      // Update title with the code itself for custom languages
      if (code) {
        store.setExportTitle(code.toUpperCase())
      }
    },
    [store]
  )

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      store.setExportTitle(e.target.value)
    },
    [store]
  )

  const isExporting = exportStep === 'exporting'
  const isDone = exportStep === 'done'
  const isError = exportStep === 'error'

  // Get secondary track info for display
  const secondaryTrack = useMemo(() => {
    return store.secondaryTracks[store.selectedSecondaryTrackIndex]
  }, [store.secondaryTracks, store.selectedSecondaryTrackIndex])

  const trackCodec = secondaryTrack?.codec?.toUpperCase() || 'Unknown'
  const trackDuration = secondaryTrack?.duration_seconds
    ? formatDuration(secondaryTrack.duration_seconds)
    : '--:--'
  const trackChannels = secondaryTrack?.channels === 1 ? 'Mono' : secondaryTrack?.channels === 2 ? 'Stereo' : `${secondaryTrack?.channels || 2}ch`

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Step indicators */}
        <div className={styles.steps}>
          <div className={`${styles.step} ${styles.completed}`}>
            <span className={styles.stepLabel}>Files & Tracks</span>
          </div>
          <ChevronRight size={16} className={styles.stepArrow} />
          <div className={`${styles.step} ${styles.completed}`}>
            <span className={styles.stepLabel}>Analyze</span>
          </div>
          <ChevronRight size={16} className={styles.stepArrow} />
          <div className={`${styles.step} ${styles.completed}`}>
            <span className={styles.stepLabel}>Edit</span>
          </div>
          <ChevronRight size={16} className={styles.stepArrow} />
          <div className={`${styles.step} ${styles.active}`}>
            <span className={styles.stepLabel}>Export</span>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {exportStep === 'options' && (
            <div className={styles.stepContent}>
              {/* New Audio Track Section */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  <Music size={16} className={styles.sectionIcon} />
                  <span>New Audio Track</span>
                </div>
                <div className={styles.trackInfoCard}>
                  <div className={styles.trackInfoRow}>
                    <span className={styles.trackInfoLabel}>Codec</span>
                    <span className={styles.trackInfoValue}>{trackCodec}</span>
                  </div>
                  <div className={styles.trackInfoRow}>
                    <span className={styles.trackInfoLabel}>Channels</span>
                    <span className={styles.trackInfoValue}>{trackChannels}</span>
                  </div>
                  <div className={styles.trackInfoRow}>
                    <span className={styles.trackInfoLabel}>Duration</span>
                    <span className={styles.trackInfoValue}>{trackDuration}</span>
                  </div>
                  <div className={styles.trackInfoRow}>
                    <span className={styles.trackInfoLabel}>Offset</span>
                    <span className={styles.trackInfoValueHighlight}>{formatOffset(store.offsetMs)}</span>
                  </div>
                  <div className={styles.trackInfoRowEditable}>
                    <span className={styles.trackInfoLabel}>Language</span>
                    {isOtherLanguage ? (
                      <input
                        type="text"
                        className={styles.inputInline}
                        value={customLanguageCode}
                        onChange={handleCustomLanguageChange}
                        placeholder="ISO code (e.g., eng)"
                        maxLength={3}
                      />
                    ) : (
                      <select
                        className={styles.selectInline}
                        value={exportLanguage.toLowerCase()}
                        onChange={handleLanguageChange}
                      >
                        {LANGUAGE_OPTIONS.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.label} ({lang.code.toUpperCase()})
                          </option>
                        ))}
                        <option value={OTHER_LANGUAGE}>Other...</option>
                      </select>
                    )}
                  </div>
                  <div className={styles.trackInfoRowEditable}>
                    <span className={styles.trackInfoLabel}>Title</span>
                    <input
                      type="text"
                      className={styles.inputInline}
                      value={exportTitle}
                      onChange={handleTitleChange}
                      placeholder="Track title"
                    />
                  </div>
                </div>
              </div>

              {/* Export Mode Section */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  <FolderOpen size={16} className={styles.sectionIcon} />
                  <span>Export Mode</span>
                </div>
                <div className={styles.optionTiles}>
                  <button
                    className={`${styles.optionTile} ${exportMode === 'add-to-original' ? styles.optionTileSelected : ''}`}
                    onClick={() => handleModeChange('add-to-original')}
                  >
                    <div className={styles.radioButton}>
                      {exportMode === 'add-to-original' && <div className={styles.radioButtonDot} />}
                    </div>
                    <div className={styles.optionTileContent}>
                      <div className={styles.optionTileHeader}>Add track to original file</div>
                      <div className={styles.optionTileDescription}>
                        Adds the aligned audio track directly to the main video file
                      </div>
                    </div>
                  </button>
                  <button
                    className={`${styles.optionTile} ${exportMode === 'create-new' ? styles.optionTileSelected : ''}`}
                    onClick={() => handleModeChange('create-new')}
                  >
                    <div className={styles.radioButton}>
                      {exportMode === 'create-new' && <div className={styles.radioButtonDot} />}
                    </div>
                    <div className={styles.optionTileContent}>
                      <div className={styles.optionTileHeader}>Create new merged file</div>
                      <div className={styles.optionTileDescription}>
                        Creates a copy of the video with the new audio track added
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {(isExporting || isDone || isError) && (
            <div className={styles.stepContent}>
              <div className={styles.exportingContent}>
                {/* Spinner or Status Icon */}
                <div className={styles.spinnerContainer}>
                  {isExporting && <WaveformSpinner size="lg" />}
                  {isDone && <Check size={48} className={styles.successIcon} />}
                  {isError && <AlertCircle size={48} className={styles.errorIcon} />}
                </div>

                {/* Task List */}
                <ul className={styles.taskList}>
                  <li
                    className={`${styles.taskItem} ${isDone || isError ? styles.completed : ''} ${isExporting ? styles.active : ''}`}
                  >
                    {isDone || isError ? (
                      <CheckCircle size={18} className={styles.taskCheckIcon} />
                    ) : (
                      <Circle size={18} className={styles.taskPendingIcon} />
                    )}
                    <span>Preparing files</span>
                  </li>
                  <li
                    className={`${styles.taskItem} ${isDone ? styles.completed : ''} ${isError ? styles.failed : ''} ${isExporting ? styles.active : ''}`}
                  >
                    {isDone ? (
                      <CheckCircle size={18} className={styles.taskCheckIcon} />
                    ) : isError ? (
                      <AlertCircle size={18} className={styles.taskErrorIcon} />
                    ) : (
                      <Circle size={18} className={styles.taskPendingIcon} />
                    )}
                    <span>Merging audio track</span>
                  </li>
                  <li className={`${styles.taskItem} ${isDone ? styles.completed : ''}`}>
                    {isDone ? (
                      <CheckCircle size={18} className={styles.taskCheckIcon} />
                    ) : (
                      <Circle size={18} className={styles.taskPendingIcon} />
                    )}
                    <span>Finalizing</span>
                  </li>
                </ul>

                {isError && exportError && <p className={styles.errorMessage}>{exportError}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.backButton} onClick={handleBack} disabled={isExporting}>
            Back
          </button>
          <div className={styles.spacer} />
          {exportStep === 'options' && (
            <button className={styles.exportButton} onClick={handleExport}>
              Export
            </button>
          )}
          {(isDone || isError) && (
            <button className={styles.doneButton} onClick={handleDone}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
