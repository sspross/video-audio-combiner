import { useState, useCallback } from 'react'
import { FolderOpen, X, Upload } from 'lucide-react'
import styles from './FileSelector.module.css'

interface FileSelectorProps {
  label: string
  filePath: string | null
  onSelect: () => void
  onFileDrop?: (filePath: string) => void
  onClear: () => void
  disabled?: boolean
}

export function FileSelector({
  label,
  filePath,
  onSelect,
  onFileDrop,
  onClear,
  disabled = false
}: FileSelectorProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileName = filePath ? filePath.split('/').pop() : null

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled || !onFileDrop) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const filePath = window.electron.getPathForFile(files[0])
      if (filePath) {
        onFileDrop(filePath)
      }
    }
  }, [disabled, onFileDrop])

  return (
    <div
      className={`${styles.container} ${isDragOver ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="label">{label}</span>
      <div className={styles.inputRow}>
        {filePath ? (
          <div className={styles.selectedFile}>
            <span className={styles.fileName} title={filePath}>
              {fileName}
            </span>
            <button
              className={styles.clearButton}
              onClick={onClear}
              disabled={disabled}
              title="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className={styles.dropZone}>
            {isDragOver ? (
              <div className={styles.dropHint}>
                <Upload size={24} />
                <span>Drop file here</span>
              </div>
            ) : (
              <>
                <button className="secondary" onClick={onSelect} disabled={disabled}>
                  <FolderOpen size={16} style={{ marginRight: 8 }} />
                  Select File
                </button>
                <span className={styles.orText}>or drag & drop</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
