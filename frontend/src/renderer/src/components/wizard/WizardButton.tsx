import { ButtonHTMLAttributes } from 'react'
import styles from './WizardButton.module.css'

export type WizardButtonVariant =
  | 'filled'
  | 'filledSoft'
  | 'filledGround'
  | 'outline'
  | 'outlineSoft'
  | 'success'
  | 'warning'
  // Legacy variants mapped to new system
  | 'primary'
  | 'secondary'

export interface WizardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WizardButtonVariant
}

export function WizardButton({
  variant = 'filled',
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
