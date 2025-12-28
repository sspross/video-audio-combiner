import { ButtonHTMLAttributes } from 'react'
import styles from './WizardButton.module.css'

export type WizardButtonVariant = 'primary' | 'secondary' | 'success' | 'warning'

export interface WizardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WizardButtonVariant
}

export function WizardButton({
  variant = 'primary',
  className,
  children,
  ...props
}: WizardButtonProps): JSX.Element {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  )
}
