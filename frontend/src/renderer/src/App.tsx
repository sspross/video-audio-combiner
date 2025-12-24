import { useCallback, useEffect, useState, useRef } from 'react'
import { Loader2, RotateCcw, AlertCircle, Download, CheckCircle } from 'lucide-react'
import { PreviewPanel } from './components/PreviewPanel'
import { AlignmentEditor } from './components/AlignmentEditor'
import { SetupWizard } from './components/SetupWizard'
import { useProjectStore } from './stores/projectStore'
import { useBackendApi } from './hooks/useBackendApi'
import styles from './App.module.css'

function App() {
  const store = useProjectStore()
  const api = useBackendApi()
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>(
    'idle'
  )
  const [exportError, setExportError] = useState<string | null>(null)
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [isAutoDetecting, setIsAutoDetecting] = useState(false)

  // Track which files we've already analyzed
  const analyzedMainRef = useRef<string | null>(null)
  const analyzedSecondaryRef = useRef<string | null>(null)

  // Check backend readiness
  useEffect(() => {
    if (api.error) {
      store.setError(api.error)
    }
  }, [api.error])

  const loadMainFile = useCallback(async (filePath: string) => {
    if (!api.isReady) return
    store.setLoading(true)
    store.setError(null)
    // Reset analyzed main file
    analyzedMainRef.current = null
    store.setMainAnalysisStep('idle')
    try {
      const tracks = await api.getAudioTracks(filePath)
      store.setMainFile(filePath, tracks.tracks)
      store.setMainAnalysisStep('pending')
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      store.setLoading(false)
    }
  }, [api.isReady])

  const loadSecondaryFile = useCallback(async (filePath: string) => {
    if (!api.isReady) return
    store.setLoading(true)
    store.setError(null)
    // Reset analyzed secondary file
    analyzedSecondaryRef.current = null
    store.setSecondaryAnalysisStep('idle')
    try {
      const tracks = await api.getAudioTracks(filePath)
      store.setSecondaryFile(filePath, tracks.tracks)
      store.setSecondaryAnalysisStep('pending')
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      store.setLoading(false)
    }
  }, [api.isReady])

  const handleSelectMainFile = useCallback(async () => {
    const filePath = await window.electron.openFile()
    if (filePath) {
      loadMainFile(filePath)
    }
  }, [loadMainFile])

  const handleSelectSecondaryFile = useCallback(async () => {
    const filePath = await window.electron.openFile()
    if (filePath) {
      loadSecondaryFile(filePath)
    }
  }, [loadSecondaryFile])

  // Analyze main file when user triggers it
  useEffect(() => {
    const analyzeMain = async () => {
      if (!store.mainFilePath || !api.isReady) return
      if (store.mainAnalysisStep !== 'extracting') return

      const mainKey = `${store.mainFilePath}:${store.selectedMainTrackIndex}`
      if (analyzedMainRef.current === mainKey) return
      analyzedMainRef.current = mainKey

      store.setError(null)

      try {
        const mainExtract = await api.extractAudio(store.mainFilePath, store.selectedMainTrackIndex)
        store.setMainWavPath(mainExtract.wav_path)

        store.setMainAnalysisStep('waveform')
        const mainWaveform = await api.generateWaveform(mainExtract.wav_path)
        store.setMainPeaks(mainWaveform.peaks)

        store.setMainAnalysisStep('idle')
      } catch (err) {
        store.setError(err instanceof Error ? err.message : 'Main file analysis failed')
        analyzedMainRef.current = null
        store.setMainAnalysisStep('pending')
      }
    }

    analyzeMain()
  }, [store.mainFilePath, store.selectedMainTrackIndex, store.mainAnalysisStep, api.isReady])

  // Analyze secondary file when user triggers it
  useEffect(() => {
    const analyzeSecondary = async () => {
      if (!store.secondaryFilePath || !api.isReady) return
      if (store.secondaryAnalysisStep !== 'extracting') return

      const secondaryKey = `${store.secondaryFilePath}:${store.selectedSecondaryTrackIndex}`
      if (analyzedSecondaryRef.current === secondaryKey) return
      analyzedSecondaryRef.current = secondaryKey

      store.setError(null)

      try {
        const secondaryExtract = await api.extractAudio(store.secondaryFilePath, store.selectedSecondaryTrackIndex)
        store.setSecondaryWavPath(secondaryExtract.wav_path)

        store.setSecondaryAnalysisStep('waveform')
        const secondaryWaveform = await api.generateWaveform(secondaryExtract.wav_path)
        store.setSecondaryPeaks(secondaryWaveform.peaks)

        store.setSecondaryAnalysisStep('idle')
      } catch (err) {
        store.setError(err instanceof Error ? err.message : 'Secondary file analysis failed')
        analyzedSecondaryRef.current = null
        store.setSecondaryAnalysisStep('pending')
      }
    }

    analyzeSecondary()
  }, [store.secondaryFilePath, store.selectedSecondaryTrackIndex, store.secondaryAnalysisStep, api.isReady])

  // Auto-advance wizard steps when files are loaded
  useEffect(() => {
    if (!store.showSetupWizard) return

    // When main file is loaded and we're on step 1, advance to step 2
    if (store.setupWizardStep === 'main-video' && store.mainFilePath && store.mainTracks.length > 0) {
      store.setSetupWizardStep('audio-source')
    }
    // When secondary file is loaded and we're on step 2, advance to step 3
    else if (store.setupWizardStep === 'audio-source' && store.secondaryFilePath && store.secondaryTracks.length > 0) {
      store.setSetupWizardStep('track-selection')
    }
  }, [store.showSetupWizard, store.setupWizardStep, store.mainFilePath, store.mainTracks.length, store.secondaryFilePath, store.secondaryTracks.length])

  // Auto-detect alignment when both waveforms are ready
  useEffect(() => {
    const detectAlignment = async () => {
      if (!store.mainWavPath || !store.secondaryWavPath || !api.isReady) return
      if (store.mainPeaks.length === 0 || store.secondaryPeaks.length === 0) return
      if (store.offsetMs !== 0 || store.confidence !== 0) return // Already aligned

      setIsAutoDetecting(true)
      try {
        const alignment = await api.detectAlignment(store.mainWavPath, store.secondaryWavPath)
        store.setOffset(alignment.offset_ms)
        store.setConfidence(alignment.confidence)
      } catch (err) {
        store.setError(err instanceof Error ? err.message : 'Alignment detection failed')
      } finally {
        setIsAutoDetecting(false)
      }
    }

    detectAlignment()
  }, [store.mainWavPath, store.secondaryWavPath, store.mainPeaks.length, store.secondaryPeaks.length, api.isReady])

  const handleAutoDetect = useCallback(async () => {
    if (!store.mainWavPath || !store.secondaryWavPath || !api.isReady) return

    setIsAutoDetecting(true)
    try {
      const alignment = await api.detectAlignment(store.mainWavPath, store.secondaryWavPath)
      store.setOffset(alignment.offset_ms)
      store.setConfidence(alignment.confidence)
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Auto-detect failed')
    } finally {
      setIsAutoDetecting(false)
    }
  }, [store.mainWavPath, store.secondaryWavPath, api.isReady])

  const handlePreviewRequest = useCallback(async () => {
    if (!store.mainFilePath || !store.secondaryWavPath || !api.isReady) return

    setIsGeneratingPreview(true)

    try {
      const result = await api.generatePreview(
        store.mainFilePath,
        store.secondaryWavPath,
        store.previewStartTimeMs / 1000,
        store.previewDurationSeconds,
        store.offsetMs,
        store.isMainAudioMuted,
        store.isSecondaryAudioMuted
      )
      setPreviewPath(result.preview_path)
      setPreviewVersion((v) => v + 1)
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Preview generation failed')
    } finally {
      setIsGeneratingPreview(false)
    }
  }, [store.mainFilePath, store.secondaryWavPath, store.previewStartTimeMs, store.previewDurationSeconds, store.offsetMs, store.isMainAudioMuted, store.isSecondaryAudioMuted, api.isReady])

  const handleExport = useCallback(async () => {
    if (!store.mainFilePath || !store.secondaryWavPath || !api.isReady) return

    const mainFileName = store.mainFilePath.split('/').pop() || 'output'
    const extension = mainFileName.split('.').pop() || 'mkv'
    const baseName = mainFileName.replace(`.${extension}`, '')

    const outputPath = await window.electron.saveFile({
      defaultPath: `${baseName}_merged.${extension}`,
      filters: [{ name: 'Video Files', extensions: [extension, 'mkv', 'mp4'] }]
    })

    if (!outputPath) return

    setExportStatus('exporting')
    setExportError(null)

    try {
      const result = await api.mergeAudio(
        store.mainFilePath,
        store.secondaryWavPath,
        store.offsetMs,
        outputPath,
        'ger',
        'German Dub'
      )

      if (result.success) {
        setExportStatus('success')
      } else {
        setExportStatus('error')
        setExportError('Export failed')
      }
    } catch (err) {
      setExportStatus('error')
      setExportError(err instanceof Error ? err.message : 'Export failed')
    }
  }, [store.mainFilePath, store.secondaryWavPath, store.offsetMs, api.isReady])

  const handleReset = useCallback(() => {
    store.reset()
    setExportStatus('idle')
    setExportError(null)
    setPreviewPath(null)
    setPreviewVersion(0)
    setIsGeneratingPreview(false)
    analyzedMainRef.current = null
    analyzedSecondaryRef.current = null
  }, [])

  if (!api.isReady) {
    return (
      <div className={styles.loadingScreen}>
        <Loader2 className={styles.spinner} size={48} />
        <span>Starting backend...</span>
        {store.error && <span className={styles.errorText}>{store.error}</span>}
      </div>
    )
  }

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Video Audio Combiner</h1>
        <div className={styles.headerActions}>
          <button className="secondary" onClick={handleReset} disabled={store.isLoading}>
            <RotateCcw size={14} style={{ marginRight: 6 }} />
            Reset
          </button>
          {exportStatus === 'idle' && (
            <button
              className="primary"
              onClick={handleExport}
              disabled={!(store.mainPeaks.length > 0 && store.secondaryPeaks.length > 0 && !store.isLoading)}
            >
              <Download size={14} style={{ marginRight: 6 }} />
              Export
            </button>
          )}
          {exportStatus === 'exporting' && (
            <button className="primary" disabled>
              <Loader2 size={14} className={styles.spinner} style={{ marginRight: 6 }} />
              Exporting...
            </button>
          )}
          {exportStatus === 'success' && (
            <button className="primary" onClick={() => setExportStatus('idle')}>
              <CheckCircle size={14} style={{ marginRight: 6 }} />
              Done!
            </button>
          )}
          {exportStatus === 'error' && (
            <button className="primary" onClick={() => setExportStatus('idle')} title={exportError || 'Export failed'}>
              <AlertCircle size={14} style={{ marginRight: 6 }} />
              Failed - Retry
            </button>
          )}
        </div>
      </header>

      {/* Video Preview - takes available space */}
      <div className={styles.previewPanel}>
        <PreviewPanel
          previewPath={previewPath}
          previewVersion={previewVersion}
          isGeneratingPreview={isGeneratingPreview}
          onPreviewRequest={handlePreviewRequest}
          onPreviewEnded={() => setPreviewPath(null)}
          extractFrame={api.extractFrame}
        />
      </div>

      {/* Timeline/Waveforms - fixed height at bottom */}
      <div className={styles.timeline}>
        <AlignmentEditor
          onAutoDetect={handleAutoDetect}
          isAutoDetecting={isAutoDetecting}
          onSelectMainFile={handleSelectMainFile}
          onSelectSecondaryFile={handleSelectSecondaryFile}
          onLoadMainFile={loadMainFile}
          onLoadSecondaryFile={loadSecondaryFile}
        />
      </div>

      {/* Error Display */}
      {store.error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={20} />
          <span>{store.error}</span>
          <button onClick={() => store.setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Setup Wizard Modal */}
      {store.showSetupWizard && (
        <SetupWizard
          onSelectMainFile={handleSelectMainFile}
          onSelectSecondaryFile={handleSelectSecondaryFile}
          onLoadMainFile={loadMainFile}
          onLoadSecondaryFile={loadSecondaryFile}
        />
      )}
    </div>
  )
}

export default App
