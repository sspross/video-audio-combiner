import { useCallback, useEffect, useState, useRef } from 'react'
import { Loader2, Download, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'
import { FileSelector } from './components/FileSelector'
import { TrackPicker } from './components/TrackPicker'
import { WaveformViewer } from './components/WaveformViewer'
import { AlignmentControls } from './components/AlignmentControls'
import { VideoPreview } from './components/VideoPreview'
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
  const lastPreviewRequest = useRef<{ startTime: number; duration: number } | null>(null)

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

  const handleAnalyze = useCallback(async () => {
    if (!store.mainFilePath || !store.secondaryFilePath || !api.isReady) return

    store.setLoading(true)
    store.setError(null)
    store.setCurrentStep('analyzing')
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
      store.setCurrentStep('align')
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Analysis failed')
      store.setCurrentStep('select-files')
      setAnalysisStep('idle')
    } finally {
      store.setLoading(false)
    }
  }, [
    store.mainFilePath,
    store.secondaryFilePath,
    store.selectedMainTrackIndex,
    store.selectedSecondaryTrackIndex,
    api.isReady
  ])

  const handleAutoDetect = useCallback(async () => {
    if (!store.mainWavPath || !store.secondaryWavPath || !api.isReady) return

    store.setLoading(true)
    try {
      const alignment = await api.detectAlignment(store.mainWavPath, store.secondaryWavPath)
      store.setOffset(alignment.offset_ms)
      store.setConfidence(alignment.confidence)
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Auto-detect failed')
    } finally {
      store.setLoading(false)
    }
  }, [store.mainWavPath, store.secondaryWavPath, api.isReady])

  const handlePreviewRequest = useCallback(
    async (startTimeSeconds: number, durationSeconds: number) => {
      if (!store.mainFilePath || !store.secondaryWavPath || !api.isReady) return

      setIsGeneratingPreview(true)
      lastPreviewRequest.current = { startTime: startTimeSeconds, duration: durationSeconds }

      try {
        const result = await api.generatePreview(
          store.mainFilePath,
          store.secondaryWavPath,
          startTimeSeconds,
          durationSeconds,
          store.offsetMs
        )
        setPreviewPath(result.preview_path)
        setPreviewVersion((v) => v + 1)
      } catch (err) {
        store.setError(err instanceof Error ? err.message : 'Preview generation failed')
      } finally {
        setIsGeneratingPreview(false)
      }
    },
    [store.mainFilePath, store.secondaryWavPath, store.offsetMs, api.isReady]
  )

  const handleRegeneratePreview = useCallback(() => {
    if (lastPreviewRequest.current) {
      handlePreviewRequest(lastPreviewRequest.current.startTime, lastPreviewRequest.current.duration)
    }
  }, [handlePreviewRequest])

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
        'ger', // Default to German since that's the use case
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
    lastPreviewRequest.current = null
  }, [])

  const canAnalyze = store.mainFilePath && store.secondaryFilePath && !store.isLoading
  const showWaveforms = store.mainPeaks.length > 0 && store.secondaryPeaks.length > 0
  const canExport = showWaveforms && !store.isLoading

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
      {store.isLoading && analysisStep !== 'idle' && (
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

      <header className={styles.header}>
        <h1 className={styles.title}>Video Audio Combiner</h1>
        <button className="secondary" onClick={handleReset} disabled={store.isLoading}>
          <RotateCcw size={16} style={{ marginRight: 8 }} />
          Reset
        </button>
      </header>

      <main className={styles.main}>
        {/* File Selection Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Select Files</h2>
          <div className={`card ${styles.fileGrid}`}>
            <div className={styles.fileColumn}>
              <FileSelector
                label="Main Video (Original)"
                filePath={store.mainFilePath}
                onSelect={handleSelectMainFile}
                onFileDrop={loadMainFile}
                onClear={() => store.setMainFile('', [])}
                disabled={store.isLoading}
              />
              {store.mainTracks.length > 0 && (
                <TrackPicker
                  label="Reference Audio Track"
                  tracks={store.mainTracks}
                  selectedIndex={store.selectedMainTrackIndex}
                  onSelect={store.setSelectedMainTrack}
                  disabled={store.isLoading}
                />
              )}
            </div>
            <div className={styles.fileColumn}>
              <FileSelector
                label="Secondary Video (Audio Source)"
                filePath={store.secondaryFilePath}
                onSelect={handleSelectSecondaryFile}
                onFileDrop={loadSecondaryFile}
                onClear={() => store.setSecondaryFile('', [])}
                disabled={store.isLoading}
              />
              {store.secondaryTracks.length > 0 && (
                <TrackPicker
                  label="Audio Track to Transfer"
                  tracks={store.secondaryTracks}
                  selectedIndex={store.selectedSecondaryTrackIndex}
                  onSelect={store.setSelectedSecondaryTrack}
                  disabled={store.isLoading}
                />
              )}
            </div>
          </div>
          {canAnalyze && !showWaveforms && (
            <button className="primary" onClick={handleAnalyze} style={{ marginTop: 16 }}>
              Analyze & Detect Alignment
            </button>
          )}
        </section>

        {/* Waveform Section */}
        {showWaveforms && (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>2. Adjust Alignment</h2>
              <AlignmentControls
                offsetMs={store.offsetMs}
                confidence={store.confidence}
                onOffsetChange={store.setOffset}
                onAutoDetect={handleAutoDetect}
                isLoading={store.isLoading}
              />
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>3. Verify Alignment</h2>
              <WaveformViewer
                mainPeaks={store.mainPeaks}
                secondaryPeaks={store.secondaryPeaks}
                mainDuration={store.mainTracks[store.selectedMainTrackIndex]?.duration_seconds || 0}
                secondaryDuration={
                  store.secondaryTracks[store.selectedSecondaryTrackIndex]?.duration_seconds || 0
                }
                offsetMs={store.offsetMs}
                onPreviewRequest={handlePreviewRequest}
                isGeneratingPreview={isGeneratingPreview}
              />
              {(previewPath || isGeneratingPreview) && (
                <div style={{ marginTop: 16 }}>
                  <VideoPreview
                    previewPath={previewPath}
                    previewVersion={previewVersion}
                    onClose={() => setPreviewPath(null)}
                    onRegenerate={handleRegeneratePreview}
                    isLoading={isGeneratingPreview}
                  />
                </div>
              )}
            </section>

            {/* Export Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>4. Export</h2>
              <div className={`card ${styles.exportSection} ${styles.exportContent}`}>
                {exportStatus === 'idle' && (
                  <button className="primary" onClick={handleExport} disabled={!canExport}>
                    <Download size={16} style={{ marginRight: 8 }} />
                    Export Merged Video
                  </button>
                )}
                {exportStatus === 'exporting' && (
                  <div className={styles.exportStatus}>
                    <Loader2 className={styles.spinner} size={24} />
                    <span>Merging audio track...</span>
                  </div>
                )}
                {exportStatus === 'success' && (
                  <div className={styles.exportStatus}>
                    <CheckCircle size={24} color="var(--success)" />
                    <span>Export completed successfully!</span>
                    <button className="secondary" onClick={() => setExportStatus('idle')}>
                      Export Another
                    </button>
                  </div>
                )}
                {exportStatus === 'error' && (
                  <div className={styles.exportStatus}>
                    <AlertCircle size={24} color="var(--accent)" />
                    <span>{exportError || 'Export failed'}</span>
                    <button className="secondary" onClick={() => setExportStatus('idle')}>
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* Error Display */}
        {store.error && (
          <div className={styles.errorBanner}>
            <AlertCircle size={20} />
            <span>{store.error}</span>
            <button onClick={() => store.setError(null)}>Dismiss</button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
