import { useRef, useEffect } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { WaveformSpinner } from './WaveformSpinner'
import styles from './VideoPreview.module.css'

interface VideoPreviewProps {
  previewPath: string | null
  previewVersion?: number
  onClose: () => void
  onRegenerate?: () => void
  isLoading?: boolean
}

export function VideoPreview({
  previewPath,
  previewVersion = 0,
  onClose,
  onRegenerate,
  isLoading = false
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (previewPath && videoRef.current) {
      // Force reload when path or version changes
      videoRef.current.load()
    }
  }, [previewPath, previewVersion])

  if (!previewPath && !isLoading) {
    return null
  }

  // Convert file path to custom protocol URL for Electron with cache-busting
  const videoUrl = previewPath ? `local-video://${encodeURIComponent(previewPath)}?v=${previewVersion}` : ''

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Preview</span>
        <div className={styles.actions}>
          {onRegenerate && (
            <button
              className={styles.actionButton}
              onClick={onRegenerate}
              disabled={isLoading}
              title="Regenerate preview"
            >
              <RotateCcw size={16} />
            </button>
          )}
          <button
            className={styles.actionButton}
            onClick={onClose}
            title="Close preview"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={styles.videoContainer}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <WaveformSpinner size="md" />
            <span>Generating preview...</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            className={styles.video}
            controls
            autoPlay
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>
    </div>
  )
}
