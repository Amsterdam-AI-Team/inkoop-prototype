import { Grid } from '@amsterdam/design-system-react'
import { ReactNode } from 'react'

interface CenteredInkoopPageProps {
  children: ReactNode
}

/**
 * A Grid.Cell that centers content with consistent spacing across all breakpoints.
 * Used throughout the inkoop pages for consistent centered layouts.
 */
export function CenteredInkoopPage({ children }: CenteredInkoopPageProps) {
  return (
    <Grid.Cell span={{ narrow: 4, medium: 6, wide: 8 }} start={{ narrow: 1, medium: 2, wide: 3 }}>
      {children}
    </Grid.Cell>
  )
}
