import { Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react'
import { FileSelector } from './FileSelector'
import { TrackPicker } from './TrackPicker'
import { useProjectStore } from '../stores/projectStore'
import styles from './SourcePanel.module.css'

interface SourcePanelProps {
  onSelectMainFile: () => void
  onSelectSecondaryFile: () => void
  onLoadMainFile: (path: string) => void
  onLoadSecondaryFile: (path: string) => void
  onExport: () => void
  isAnalyzing: boolean
  exportStatus: 'idle' | 'exporting' | 'success' | 'error'
  exportError: string | null
  onResetExport: () => void
}

export function SourcePanel({
  onSelectMainFile,
  onSelectSecondaryFile,
  onLoadMainFile,
  onLoadSecondaryFile,
  onExport,
  isAnalyzing,
  exportStatus,
  exportError,
  onResetExport
}: SourcePanelProps) {
  const store = useProjectStore()
  const canExport = store.mainPeaks.length > 0 && store.secondaryPeaks.length > 0 && !store.isLoading

  return (
    <div className={styles.panel}>
      {/* Main Video Section */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Main Video</span>
        <FileSelector
          label=""
          filePath={store.mainFilePath}
          onSelect={onSelectMainFile}
          onFileDrop={onLoadMainFile}
          onClear={() => store.setMainFile('', [])}
          disabled={store.isLoading}
        />
        {store.mainTracks.length > 0 && (
          <TrackPicker
            label="Reference Track"
            tracks={store.mainTracks}
            selectedIndex={store.selectedMainTrackIndex}
            onSelect={store.setSelectedMainTrack}
            disabled={store.isLoading}
          />
        )}
      </div>

      <div className={styles.divider} />

      {/* Secondary Video Section */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Audio Source</span>
        <FileSelector
          label=""
          filePath={store.secondaryFilePath}
          onSelect={onSelectSecondaryFile}
          onFileDrop={onLoadSecondaryFile}
          onClear={() => store.setSecondaryFile('', [])}
          disabled={store.isLoading}
        />
        {store.secondaryTracks.length > 0 && (
          <TrackPicker
            label="Track to Transfer"
            tracks={store.secondaryTracks}
            selectedIndex={store.selectedSecondaryTrackIndex}
            onSelect={store.setSelectedSecondaryTrack}
            disabled={store.isLoading}
          />
        )}
      </div>

      {/* Analysis Loading */}
      {isAnalyzing && (
        <div className={styles.loadingIndicator}>
          <Loader2 size={16} className={styles.spinner} />
          <span>Analyzing audio...</span>
        </div>
      )}

      {/* Export Section */}
      <div className={styles.exportSection}>
        {exportStatus === 'idle' && (
          <button
            className="primary"
            onClick={onExport}
            disabled={!canExport}
            style={{ width: '100%' }}
          >
            <Download size={16} style={{ marginRight: 8 }} />
            Export Merged Video
          </button>
        )}
        {exportStatus === 'exporting' && (
          <div className={styles.exportStatus}>
            <Loader2 size={16} className={styles.spinner} />
            <span>Merging audio...</span>
          </div>
        )}
        {exportStatus === 'success' && (
          <div className={`${styles.exportStatus} ${styles.success}`}>
            <CheckCircle size={16} />
            <span>Export complete!</span>
            <button className="secondary" onClick={onResetExport} style={{ marginLeft: 'auto' }}>
              Export Another
            </button>
          </div>
        )}
        {exportStatus === 'error' && (
          <div className={`${styles.exportStatus} ${styles.error}`}>
            <AlertCircle size={16} />
            <span>{exportError || 'Export failed'}</span>
            <button className="secondary" onClick={onResetExport} style={{ marginLeft: 'auto' }}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
