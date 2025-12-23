import { Wand2 } from 'lucide-react'
import styles from './AlignmentControls.module.css'

interface AlignmentControlsProps {
  offsetMs: number
  confidence: number
  onOffsetChange: (offset: number) => void
  onAutoDetect: () => void
  isLoading: boolean
}

export function AlignmentControls({
  offsetMs,
  confidence,
  onOffsetChange,
  onAutoDetect,
  isLoading
}: AlignmentControlsProps) {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onOffsetChange(parseInt(e.target.value))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value)) {
      onOffsetChange(Math.max(-10000, Math.min(10000, value)))
    }
  }

  const confidencePercent = Math.round(confidence * 100)
  const confidenceColor =
    confidence >= 0.7 ? 'var(--success)' : confidence >= 0.4 ? 'var(--warning)' : 'var(--accent)'

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Audio Alignment</span>
        <button className="primary" onClick={onAutoDetect} disabled={isLoading}>
          <Wand2 size={16} style={{ marginRight: 8 }} />
          {isLoading ? 'Detecting...' : 'Auto Detect'}
        </button>
      </div>

      {confidence > 0 && (
        <div className={styles.confidenceRow}>
          <span className={styles.confidenceLabel}>Detection Confidence:</span>
          <span className={styles.confidenceValue} style={{ color: confidenceColor }}>
            {confidencePercent}%
          </span>
          <div className={styles.confidenceBar}>
            <div
              className={styles.confidenceFill}
              style={{ width: `${confidencePercent}%`, backgroundColor: confidenceColor }}
            />
          </div>
        </div>
      )}

      <div className={styles.offsetControls}>
        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>-10s</span>
          <input
            type="range"
            min="-10000"
            max="10000"
            value={offsetMs}
            onChange={handleSliderChange}
            className={styles.slider}
          />
          <span className={styles.sliderLabel}>+10s</span>
        </div>

        <div className={styles.inputRow}>
          <span className="label">Offset (ms)</span>
          <input
            type="number"
            value={offsetMs}
            onChange={handleInputChange}
            min="-10000"
            max="10000"
            step="10"
            className={styles.numberInput}
          />
        </div>
      </div>

      <div className={styles.hint}>
        Positive offset = new audio starts later. Negative = new audio starts earlier.
      </div>
    </div>
  )
}
