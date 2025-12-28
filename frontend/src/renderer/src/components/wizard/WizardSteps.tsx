import { ChevronRight } from 'lucide-react'
import styles from './WizardSteps.module.css'

export interface WizardStep {
  id: string
  label: string
}

export interface WizardStepsProps {
  steps: WizardStep[]
  currentStep: string
  completedSteps?: string[]
}

export function WizardSteps({ steps, currentStep, completedSteps = [] }: WizardStepsProps): JSX.Element {
  const getStepStatus = (stepId: string): 'active' | 'completed' | 'pending' => {
    if (stepId === currentStep) return 'active'
    if (completedSteps.includes(stepId)) return 'completed'
    return 'pending'
  }

  return (
    <div className={styles.steps}>
      {steps.map((step, index) => {
        const status = getStepStatus(step.id)
        return (
          <div key={step.id} className={styles.stepWrapper}>
            <div
              className={`${styles.step} ${status === 'active' ? styles.active : ''} ${status === 'completed' ? styles.completed : ''}`}
            >
              <span className={styles.stepLabel}>{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight size={16} className={styles.stepArrow} />
            )}
          </div>
        )
      })}
    </div>
  )
}
