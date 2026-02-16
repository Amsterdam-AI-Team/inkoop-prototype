import styles from './Step.module.css'

export type StepStatus = 'active' | 'completed' | 'upcoming' | 'disabled'

interface StepProps {
  number: number
  label: string
  status?: StepStatus
}

export const Step = ({ number, label, status = 'upcoming' }: StepProps) => {
  const statusNumberClass = styles[`${status}Number` as keyof typeof styles]
  const statusLabelClass = styles[`${status}Label` as keyof typeof styles]
  const statusBarClass = styles[`${status}Bar` as keyof typeof styles]

  return (
    <div className={styles.step}>
      {/* <div className={[styles.stepNumber, statusNumberClass].filter(Boolean).join(' ')}>
        Stap {number}
      </div> */}
      <div className={[styles.stepLabel, statusLabelClass].filter(Boolean).join(' ')}>
        Stap {number}: {label}
      </div>
      <div className={[styles.stepBar, statusBarClass].filter(Boolean).join(' ')} />
    </div>
  )
}
