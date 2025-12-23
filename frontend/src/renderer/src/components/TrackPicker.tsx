import type { AudioTrack } from '../types'
import styles from './TrackPicker.module.css'

interface TrackPickerProps {
  label: string
  tracks: AudioTrack[]
  selectedIndex: number
  onSelect: (index: number) => void
  disabled?: boolean
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTrackLabel(track: AudioTrack): string {
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
  disabled = false
}: TrackPickerProps) {
  if (tracks.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
      <span className="label">{label}</span>
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
