import { useCallback, useEffect, useState, useRef } from 'react'
import { AlertCircle } from 'lucide-react'
import { WaveformSpinner } from './components/WaveformSpinner'
import { PreviewPanel } from './components/PreviewPanel'
import { AlignmentEditor } from './components/AlignmentEditor'
import { SetupWizard } from './components/SetupWizard'
import { ExportModal } from './components/ExportModal'
import { WizardSteps, WIZARD_STEPS } from './components/wizard'
import { useProjectStore } from './stores/projectStore'
import { useBackendApi } from './hooks/useBackendApi'
import styles from './App.module.css'

function App() {
  const store = useProjectStore()
  const api = useBackendApi()
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [isAutoDetecting, setIsAutoDetecting] = useState(false)

  // Abort controller for preview generation
  const previewAbortControllerRef = useRef<AbortController | null>(null)

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
      store.setMainFile(filePath, tracks.tracks, tracks.video_framerate)
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
      store.setSecondaryFile(filePath, tracks.tracks, tracks.video_framerate)
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

      // Capture version at start to detect if analysis becomes stale
      const version = store.analysisVersion

      store.setError(null)

      try {
        const mainExtract = await api.extractAudio(store.mainFilePath, store.selectedMainTrackIndex)

        // Check if stale before each state update
        if (store.analysisVersion !== version) return
        store.setMainWavPath(mainExtract.wav_path)

        if (store.analysisVersion !== version) return
        store.setMainAnalysisStep('waveform')

        const mainWaveform = await api.generateWaveform(mainExtract.wav_path)

        if (store.analysisVersion !== version) return
        store.setMainPeaks(mainWaveform.peaks, mainWaveform.duration_seconds)

        if (store.analysisVersion !== version) return
        store.setMainAnalysisStep('idle')
      } catch (err) {
        if (store.analysisVersion !== version) return
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

      // Capture version at start to detect if analysis becomes stale
      const version = store.analysisVersion

      store.setError(null)

      try {
        // Pass main framerate as target to auto-stretch secondary audio if needed
        const secondaryExtract = await api.extractAudio(
          store.secondaryFilePath,
          store.selectedSecondaryTrackIndex,
          store.mainFramerate ?? undefined
        )

        // Check if stale before each state update
        if (store.analysisVersion !== version) return
        store.setSecondaryWavPath(secondaryExtract.wav_path)

        // Store stretch info
        if (store.analysisVersion !== version) return
        store.setSecondaryStretchInfo(secondaryExtract.stretched, secondaryExtract.tempo_ratio)

        if (store.analysisVersion !== version) return
        store.setSecondaryAnalysisStep('waveform')

        const secondaryWaveform = await api.generateWaveform(secondaryExtract.wav_path)

        if (store.analysisVersion !== version) return
        store.setSecondaryPeaks(secondaryWaveform.peaks, secondaryWaveform.duration_seconds)

        if (store.analysisVersion !== version) return
        store.setSecondaryAnalysisStep('idle')
      } catch (err) {
        if (store.analysisVersion !== version) return
        store.setError(err instanceof Error ? err.message : 'Secondary file analysis failed')
        analyzedSecondaryRef.current = null
        store.setSecondaryAnalysisStep('pending')
      }
    }

    analyzeSecondary()
  }, [store.secondaryFilePath, store.selectedSecondaryTrackIndex, store.secondaryAnalysisStep, store.mainFramerate, api.isReady])

  // Clear analysis refs when analysis is reset (e.g., when going back in wizard)
  useEffect(() => {
    if (store.mainAnalysisStep === 'pending') {
      analyzedMainRef.current = null
    }
  }, [store.mainAnalysisStep])

  useEffect(() => {
    if (store.secondaryAnalysisStep === 'pending') {
      analyzedSecondaryRef.current = null
    }
  }, [store.secondaryAnalysisStep])

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

    // Cancel any existing preview generation
    previewAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    previewAbortControllerRef.current = abortController

    setIsGeneratingPreview(true)

    try {
      const result = await api.generatePreview(
        store.mainFilePath,
        store.secondaryWavPath,
        store.previewStartTimeMs / 1000,
        store.previewDurationSeconds,
        store.offsetMs,
        store.isMainAudioMuted,
        store.isSecondaryAudioMuted,
        store.secondaryFilePath ?? undefined, // Side-by-side video
        abortController.signal
      )
      if (!abortController.signal.aborted) {
        setPreviewPath(result.preview_path)
        setPreviewVersion((v) => v + 1)
      }
    } catch (err: unknown) {
      if (!abortController.signal.aborted) {
        // Extract detailed error message from axios response if available
        let errorMessage = 'Preview generation failed'
        if (err && typeof err === 'object') {
          const axiosError = err as { response?: { data?: { detail?: string } }; message?: string }
          if (axiosError.response?.data?.detail) {
            errorMessage = axiosError.response.data.detail
          } else if (axiosError.message) {
            errorMessage = axiosError.message
          }
        }
        store.setError(errorMessage)
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsGeneratingPreview(false)
      }
      if (previewAbortControllerRef.current === abortController) {
        previewAbortControllerRef.current = null
      }
    }
  }, [store.mainFilePath, store.secondaryFilePath, store.secondaryWavPath, store.previewStartTimeMs, store.previewDurationSeconds, store.offsetMs, store.isMainAudioMuted, store.isSecondaryAudioMuted, api.isReady])

  const handleStopPreviewGeneration = useCallback(() => {
    previewAbortControllerRef.current?.abort()
    previewAbortControllerRef.current = null
    setIsGeneratingPreview(false)
  }, [])

  // Clear stale preview when preview parameters change
  useEffect(() => {
    setPreviewPath(null)
  }, [store.previewStartTimeMs, store.previewDurationSeconds, store.offsetMs, store.isMainAudioMuted, store.isSecondaryAudioMuted])

  // Handler for export modal to request save path
  const handleRequestSavePath = useCallback(
    async (defaultName: string, extension: string): Promise<string | null> => {
      return window.electron.saveFile({
        defaultPath: defaultName,
        filters: [{ name: 'Video Files', extensions: [extension, 'mkv', 'mp4'] }]
      })
    },
    []
  )

  if (!api.isReady) {
    return (
      <div className={styles.loadingScreen}>
        <WaveformSpinner size="lg" />
        {store.error && <span className={styles.errorText}>{store.error}</span>}
      </div>
    )
  }

  return (
    <div className={styles.app}>
      {/* Header - Step Bar */}
      <header className={styles.header}>
        <WizardSteps
          steps={[...WIZARD_STEPS]}
          currentStep="edit"
          completedSteps={['files-tracks']}
        />
      </header>

      {/* Video Preview - takes available space */}
      <div className={styles.previewPanel}>
        <PreviewPanel
          previewPath={previewPath}
          previewVersion={previewVersion}
          isGeneratingPreview={isGeneratingPreview}
          onPreviewRequest={handlePreviewRequest}
          onPreviewEnded={() => setPreviewPath(null)}
          onStopGeneration={handleStopPreviewGeneration}
          extractFrame={api.extractFrame}
          offsetMs={store.offsetMs}
          onAutoDetect={handleAutoDetect}
          isAutoDetecting={isAutoDetecting}
        />
      </div>

      {/* Timeline/Waveforms - fixed height at bottom */}
      <div className={styles.timeline}>
        <AlignmentEditor
          canContinue={store.mainPeaks.length > 0 && store.secondaryPeaks.length > 0 && !store.isLoading}
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

      {/* Export Modal */}
      {store.showExportModal && <ExportModal onRequestSavePath={handleRequestSavePath} />}
    </div>
  )
}

export default App
