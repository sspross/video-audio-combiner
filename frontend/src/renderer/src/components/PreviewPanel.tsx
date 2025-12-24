import { Play, Loader2, Video } from 'lucide-react'
import { VideoFramePreview } from './VideoFramePreview'
import { useProjectStore } from '../stores/projectStore'
import type { FrameResponse } from '../types'
import styles from './PreviewPanel.module.css'

interface PreviewPanelProps {
  previewPath: string | null
  previewVersion: number
  isGeneratingPreview: boolean
  onPreviewRequest: () => void
  onPreviewEnded: () => void
  extractFrame: (videoPath: string, timeSeconds: number) => Promise<FrameResponse>
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = Math.floor((ms % 1000) / 10)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`
}

export function PreviewPanel({
  previewPath,
  previewVersion,
  isGeneratingPreview,
  onPreviewRequest,
  onPreviewEnded,
  extractFrame
}: PreviewPanelProps) {
  const store = useProjectStore()
  const hasWaveforms = store.mainPeaks.length > 0 && store.secondaryPeaks.length > 0

  return (
    <div className={styles.panel}>
      {/* Video Container */}
      <div className={styles.videoContainer}>
        {store.mainFilePath ? (
          <VideoFramePreview
            videoPath={store.mainFilePath}
            cursorPositionMs={store.cursorPositionMs}
            previewPath={previewPath}
            previewVersion={previewVersion}
            isGeneratingPreview={isGeneratingPreview}
            onPreviewEnded={onPreviewEnded}
            extractFrame={extractFrame}
          />
        ) : (
          <div className={styles.placeholder}>
            <Video size={48} className={styles.placeholderIcon} />
            <span>No video loaded</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {/* Play Button */}
        <button
          className={styles.playButton}
          onClick={onPreviewRequest}
          disabled={!hasWaveforms || isGeneratingPreview}
          title="Generate preview"
        >
          {isGeneratingPreview ? (
            <Loader2 size={20} className={styles.spinner} />
          ) : (
            <Play size={20} style={{ marginLeft: 2 }} />
          )}
        </button>

        {/* Time Display */}
        <div className={styles.timeDisplay}>
          {formatTime(store.cursorPositionMs)}
        </div>
      </div>
    </div>
  )
}
