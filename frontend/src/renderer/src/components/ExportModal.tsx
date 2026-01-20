import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderOpen, Music } from 'lucide-react'
import { WaveformSpinner } from './WaveformSpinner'
import { WizardSteps, WizardHeader, WizardFooter, WizardButton, WIZARD_STEPS } from './wizard'
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

  const exportMode = store.exportMode
  const exportLanguage = store.exportLanguage
  const exportTitle = store.exportTitle

  // Local state for "Other" language mode and exporting status
  const [isOtherLanguage, setIsOtherLanguage] = useState(false)
  const [customLanguageCode, setCustomLanguageCode] = useState('')
  const [isExporting, setIsExporting] = useState(false)

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
    store.resetExportModal()
  }, [store])

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

    setIsExporting(true)

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
        setIsExporting(false)
        await window.electron.showExportSuccess(result.output_path || outputPath)
        // Stay on export settings screen for potential re-export
      } else {
        setIsExporting(false)
        await window.electron.showExportError('Export failed')
      }
    } catch (err) {
      setIsExporting(false)
      await window.electron.showExportError(err instanceof Error ? err.message : 'Export failed')
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
        {/* Header with steps */}
        <WizardHeader>
          <WizardSteps
            steps={[...WIZARD_STEPS]}
            currentStep="export"
            completedSteps={['files-tracks', 'edit']}
          />
        </WizardHeader>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.stepContent}>
              {/* New Audio Track Section */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  <Music size={16} className={styles.sectionIcon} />
                  <span>New Audio Track</span>
                </div>
                <div className={styles.trackInfoCard}>
                  <div className={styles.trackInfoRow}>
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
                    <div className={styles.trackInfoCompact}>
                      <span>{trackCodec}</span>
                      <span className={styles.infoDot}>•</span>
                      <span>{trackChannels}</span>
                      <span className={styles.infoDot}>•</span>
                      <span>{trackDuration}</span>
                    </div>
                  </div>
                  <div className={styles.trackModificationsRow}>
                    <span className={styles.modificationLabel}>Sync Offset</span>
                    <span className={styles.offsetValue}>{formatOffset(store.offsetMs)}</span>
                  </div>
                  {store.secondaryAudioStretched && store.secondaryTempoRatio && (
                    <div className={styles.trackModificationsRow}>
                      <span className={styles.modificationLabel}>Speed Adjustment</span>
                      <span className={styles.stretchValue}>
                        {store.secondaryTempoRatio > 1 ? '+' : '-'}{Math.abs((1 - 1 / store.secondaryTempoRatio) * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
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
                    className={`${styles.optionTile} ${exportMode === 'create-new' ? styles.optionTileSelected : ''}`}
                    onClick={() => handleModeChange('create-new')}
                  >
                    <div className={styles.radioButton}>
                      {exportMode === 'create-new' && <div className={styles.radioButtonDot} />}
                    </div>
                    <div className={styles.optionTileContent}>
                      <div className={styles.optionTileHeader}>Create new merged file</div>
                      <div className={styles.optionTileDescription}>
                        Creates a copy of the main movie file with the new audio track added
                      </div>
                    </div>
                  </button>
                  <button
                    className={`${styles.optionTile} ${exportMode === 'add-to-original' ? styles.optionTileSelected : ''}`}
                    onClick={() => handleModeChange('add-to-original')}
                  >
                    <div className={styles.radioButton}>
                      {exportMode === 'add-to-original' && <div className={styles.radioButtonDot} />}
                    </div>
                    <div className={styles.optionTileContent}>
                      <div className={styles.optionTileHeader}>Add track to original main movie file</div>
                      <div className={styles.optionTileDescriptionPath} title={store.mainFilePath || ''}>
                        {store.mainFilePath}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

        {/* Footer */}
        <WizardFooter
          leftContent={
            <WizardButton variant="secondary" onClick={handleBack} disabled={isExporting}>
              Back
            </WizardButton>
          }
          rightContent={
            <>
              {isExporting && (
                <span className={styles.exportingStatus}>Writing movie file...</span>
              )}
              <WizardButton onClick={handleExport} disabled={isExporting}>
                {isExporting && <WaveformSpinner size="sm" className={styles.buttonSpinner} />}
                Export
              </WizardButton>
            </>
          }
        />
      </div>
    </div>
  )
}
