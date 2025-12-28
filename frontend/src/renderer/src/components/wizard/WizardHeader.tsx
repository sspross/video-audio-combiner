import { ReactNode } from 'react'
import styles from './WizardHeader.module.css'

export interface WizardHeaderProps {
  children?: ReactNode
  className?: string
}

export function WizardHeader({ children, className }: WizardHeaderProps): JSX.Element {
  return (
    <div className={`${styles.header} ${className || ''}`}>
      {children}
    </div>
  )
}
