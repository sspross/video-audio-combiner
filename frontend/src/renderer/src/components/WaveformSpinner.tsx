import styles from './WaveformSpinner.module.css'

interface WaveformSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function WaveformSpinner({ size = 'md', className }: WaveformSpinnerProps) {
  const sizeClass = styles[size]

  return (
    <div className={`${styles.spinner} ${sizeClass} ${className || ''}`}>
      <span className={styles.bar} />
      <span className={styles.bar} />
      <span className={styles.bar} />
      <span className={styles.bar} />
      <span className={styles.bar} />
    </div>
  )
}
