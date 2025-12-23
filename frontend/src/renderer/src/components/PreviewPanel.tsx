import { Play, Loader2, Video, Volume2, VolumeX } from 'lucide-react'
import { VideoFramePreview } from './VideoFramePreview'
import { useProjectStore } from '../stores/projectStore'
import styles from './PreviewPanel.module.css'

interface PreviewPanelProps {
  previewPath: string | null
  previewVersion: number
  isGeneratingPreview: boolean
  onPreviewRequest: () => void
  onPreviewEnded: () => void
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
  onPreviewEnded
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
        {/* Mute Toggles */}
        <div className={styles.muteToggles}>
          <button
            className={`${styles.muteButton} ${styles.main} ${store.isMainAudioMuted ? styles.muted : ''}`}
            onClick={store.toggleMainAudioMute}
            title={store.isMainAudioMuted ? 'Unmute main audio' : 'Mute main audio'}
          >
            {store.isMainAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            Main
          </button>
          <button
            className={`${styles.muteButton} ${styles.secondary} ${store.isSecondaryAudioMuted ? styles.muted : ''}`}
            onClick={store.toggleSecondaryAudioMute}
            title={store.isSecondaryAudioMuted ? 'Unmute secondary audio' : 'Mute secondary audio'}
          >
            {store.isSecondaryAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            Secondary
          </button>
        </div>

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
