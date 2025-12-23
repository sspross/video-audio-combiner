import type { AudioTrack } from '../types'
import styles from './TrackPicker.module.css'

interface TrackPickerProps {
  label: string
  tracks: AudioTrack[]
  selectedIndex: number
  onSelect: (index: number) => void
  disabled?: boolean
  compact?: boolean
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTrackLabel(track: AudioTrack): string {
  // Handle placeholder/empty track
  if (track.codec === '—' || track.duration_seconds === 0) {
    return '— | — | —'
  }

  const parts: string[] = []

  if (track.title) {
    parts.push(track.title)
  } else if (track.language) {
    parts.push(track.language.toUpperCase())
  } else {
    parts.push(`Track ${track.index + 1}`)
  }

  parts.push(`${track.codec.toUpperCase()}`)
  parts.push(`${track.channels}ch`)
  parts.push(formatDuration(track.duration_seconds))

  return parts.join(' | ')
}

export function TrackPicker({
  label,
  tracks,
  selectedIndex,
  onSelect,
  disabled = false,
  compact = false
}: TrackPickerProps) {
  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      {label && <span className="label">{label}</span>}
      <select
        value={selectedIndex}
        onChange={(e) => onSelect(parseInt(e.target.value))}
        disabled={disabled}
        className={styles.select}
      >
        {tracks.map((track) => (
          <option key={track.index} value={track.index}>
            {formatTrackLabel(track)}
          </option>
        ))}
      </select>
    </div>
  )
}
