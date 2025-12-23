import { useCallback, useEffect, useState, useRef } from 'react'
import { Loader2, RotateCcw, AlertCircle } from 'lucide-react'
import { SourcePanel } from './components/SourcePanel'
import { PreviewPanel } from './components/PreviewPanel'
import { AlignmentEditor } from './components/AlignmentEditor'
import { useProjectStore } from './stores/projectStore'
import { useBackendApi } from './hooks/useBackendApi'
import styles from './App.module.css'

type AnalysisStep = 'idle' | 'extracting' | 'waveforms' | 'aligning' | 'done'

function App() {
  const store = useProjectStore()
  const api = useBackendApi()
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>(
    'idle'
  )
  const [exportError, setExportError] = useState<string | null>(null)
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle')
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [isAutoDetecting, setIsAutoDetecting] = useState(false)

  // Track if we've already analyzed the current file combination
  const analyzedFilesRef = useRef<string | null>(null)

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
    // Reset analyzed files when main file changes
    analyzedFilesRef.current = null
    try {
      const tracks = await api.getAudioTracks(filePath)
      store.setMainFile(filePath, tracks.tracks)
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
    // Reset analyzed files when secondary file changes
    analyzedFilesRef.current = null
    try {
      const tracks = await api.getAudioTracks(filePath)
      store.setSecondaryFile(filePath, tracks.tracks)
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

  // Auto-analyze when both files are selected
  useEffect(() => {
    const runAnalysis = async () => {
      if (!store.mainFilePath || !store.secondaryFilePath || !api.isReady) return
      if (store.isLoading) return

      // Create a key for the current file combination
      const filesKey = `${store.mainFilePath}:${store.selectedMainTrackIndex}:${store.secondaryFilePath}:${store.selectedSecondaryTrackIndex}`

      // Skip if we've already analyzed this combination
      if (analyzedFilesRef.current === filesKey) return
      analyzedFilesRef.current = filesKey

      store.setLoading(true)
      store.setError(null)
      setAnalysisStep('extracting')

      try {
        // Extract audio from both files
        const [mainExtract, secondaryExtract] = await Promise.all([
          api.extractAudio(store.mainFilePath, store.selectedMainTrackIndex),
          api.extractAudio(store.secondaryFilePath, store.selectedSecondaryTrackIndex)
        ])

        store.setMainWavPath(mainExtract.wav_path)
        store.setSecondaryWavPath(secondaryExtract.wav_path)

        // Generate waveforms
        setAnalysisStep('waveforms')
        const [mainWaveform, secondaryWaveform] = await Promise.all([
          api.generateWaveform(mainExtract.wav_path),
          api.generateWaveform(secondaryExtract.wav_path)
        ])

        store.setMainPeaks(mainWaveform.peaks)
        store.setSecondaryPeaks(secondaryWaveform.peaks)

        // Auto-detect alignment
        setAnalysisStep('aligning')
        const alignment = await api.detectAlignment(mainExtract.wav_path, secondaryExtract.wav_path)
        store.setOffset(alignment.offset_ms)
        store.setConfidence(alignment.confidence)

        setAnalysisStep('done')
      } catch (err) {
        store.setError(err instanceof Error ? err.message : 'Analysis failed')
        analyzedFilesRef.current = null // Allow retry
        setAnalysisStep('idle')
      } finally {
        store.setLoading(false)
      }
    }

    runAnalysis()
  }, [
    store.mainFilePath,
    store.secondaryFilePath,
    store.selectedMainTrackIndex,
    store.selectedSecondaryTrackIndex,
    api.isReady
  ])

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
        store.cursorPositionMs / 1000,
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
  }, [store.mainFilePath, store.secondaryWavPath, store.cursorPositionMs, store.previewDurationSeconds, store.offsetMs, store.isMainAudioMuted, store.isSecondaryAudioMuted, api.isReady])

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
    setAnalysisStep('idle')
    setPreviewPath(null)
    setPreviewVersion(0)
    setIsGeneratingPreview(false)
    analyzedFilesRef.current = null
  }, [])

  const isAnalyzing = analysisStep !== 'idle' && analysisStep !== 'done' && store.isLoading

  const getAnalysisStepText = () => {
    switch (analysisStep) {
      case 'extracting':
        return 'Extracting audio tracks...'
      case 'waveforms':
        return 'Generating waveforms...'
      case 'aligning':
        return 'Detecting alignment...'
      default:
        return 'Analyzing...'
    }
  }

  const getAnalysisProgress = () => {
    switch (analysisStep) {
      case 'extracting':
        return 25
      case 'waveforms':
        return 50
      case 'aligning':
        return 75
      case 'done':
        return 100
      default:
        return 0
    }
  }

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
      {/* Loading Overlay */}
      {isAnalyzing && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>
            <Loader2 className={styles.spinner} size={48} />
            <span className={styles.loadingText}>{getAnalysisStepText()}</span>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${getAnalysisProgress()}%` }}
              />
            </div>
            <span className={styles.progressText}>{getAnalysisProgress()}%</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Video Audio Combiner</h1>
        <button className="secondary" onClick={handleReset} disabled={store.isLoading}>
          <RotateCcw size={14} style={{ marginRight: 6 }} />
          Reset
        </button>
      </header>

      {/* Left Panel - Source Files */}
      <div className={styles.sourcePanel}>
        <SourcePanel
          onSelectMainFile={handleSelectMainFile}
          onSelectSecondaryFile={handleSelectSecondaryFile}
          onLoadMainFile={loadMainFile}
          onLoadSecondaryFile={loadSecondaryFile}
          onExport={handleExport}
          isAnalyzing={isAnalyzing}
          exportStatus={exportStatus}
          exportError={exportError}
          onResetExport={() => setExportStatus('idle')}
        />
      </div>

      {/* Right Panel - Preview */}
      <div className={styles.previewPanel}>
        <PreviewPanel
          previewPath={previewPath}
          previewVersion={previewVersion}
          isGeneratingPreview={isGeneratingPreview}
          onPreviewRequest={handlePreviewRequest}
          onPreviewEnded={() => setPreviewPath(null)}
        />
      </div>

      {/* Bottom Panel - Timeline */}
      <div className={styles.timeline}>
        <AlignmentEditor
          onAutoDetect={handleAutoDetect}
          isAutoDetecting={isAutoDetecting}
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
    </div>
  )
}

export default App
