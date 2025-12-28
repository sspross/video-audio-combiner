export { WizardSteps } from './WizardSteps'
export type { WizardStep, WizardStepsProps } from './WizardSteps'

export { WizardButton } from './WizardButton'
export type { WizardButtonVariant, WizardButtonProps } from './WizardButton'

export { WizardFooter } from './WizardFooter'
export type { WizardFooterProps } from './WizardFooter'

export { WizardHeader } from './WizardHeader'
export type { WizardHeaderProps } from './WizardHeader'

// Shared step definitions for the wizard
export const WIZARD_STEPS = [
  { id: 'files-tracks', label: 'Files & Tracks' },
  { id: 'edit', label: 'Align Audio' },
  { id: 'export', label: 'Export' },
] as const
