'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import NextLink from 'next/link'
import { Step, StepStatus } from '@/components/Step'
import { useFlow, useDocuments } from '@/hooks/useInkoopData'
import { useRuns } from '@/hooks/useRuns'
import styles from './ProjectSteps.module.css'

const STEPS = [
  {
    number: 1,
    label: 'Instructie taalmodel',
    path: '/project/instructie',
  },
  {
    number: 2,
    label: 'Bronnen toevoegen',
    path: '/project/bronnen',
  },
  {
    number: 3,
    label: 'Concepttekst',
    path: '/project/concepttekst',
  },
]

export function ProjectSteps() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const flowId = searchParams.get('flowId')
  const collectionId = searchParams.get('collectionId')

  // Fetch data to determine completion status
  const { flow } = useFlow(flowId)
  const { documents } = useDocuments(flowId)
  const { runs } = useRuns(flowId)

  // Find current step index
  const currentStepIndex = STEPS.findIndex((step) => step.path === pathname)

  // Build query params
  const queryParams = `flowId=${flowId}&collectionId=${collectionId}`

  // Check completion status for each step
  const hasInstructionData = flow?.context_content !== null && flow?.context_content !== ''
  const hasSources = documents && documents.length > 0
  const hasVersions = runs && runs.length > 0

  return (
    <div className={styles.steps}>
      {STEPS.map((step, index) => {
        // Determine status based on actual data
        let status: StepStatus = 'upcoming'

        // Check if step is completed based on data
        let isCompleted = false
        if (index === 0) {
          // Step 1: Instructie
          isCompleted = hasInstructionData
        } else if (index === 1) {
          // Step 2: Bronnen
          isCompleted = hasSources
        } else if (index === 2) {
          // Step 3: Concepttekst
          isCompleted = hasVersions
        }

        // Set status
        if (index === currentStepIndex) {
          status = 'active'
        } else if (isCompleted) {
          status = 'completed'
        }

        const href = `${step.path}?${queryParams}`

        return (
          <NextLink href={href} key={step.path} className={styles.stepLink}>
            <Step number={step.number} label={step.label} status={status} />
          </NextLink>
        )
      })}
    </div>
  )
}
