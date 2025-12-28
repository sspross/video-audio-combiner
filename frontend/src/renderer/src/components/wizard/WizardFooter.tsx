import { ReactNode } from 'react'
import styles from './WizardFooter.module.css'

export interface WizardFooterProps {
  leftContent?: ReactNode
  centerContent?: ReactNode
  rightContent?: ReactNode
  className?: string
}

export function WizardFooter({
  leftContent,
  centerContent,
  rightContent,
  className
}: WizardFooterProps): JSX.Element {
  return (
    <div className={`${styles.footer} ${className || ''}`}>
      <div className={styles.left}>{leftContent}</div>
      <div className={styles.center}>{centerContent}</div>
      <div className={styles.right}>{rightContent}</div>
    </div>
  )
}
