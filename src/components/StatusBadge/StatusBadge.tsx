import { Badge } from '@amsterdam/design-system-react'
import { DocumentsIcon, PencilIcon } from '@amsterdam/design-system-react-icons'

export type BadgeState = 'generated' | 'edited' | 'unsaved'

interface StatusBadgeProps {
  versionNumber: number
  state: BadgeState
}

export function StatusBadge({ versionNumber, state }: StatusBadgeProps) {
  const config = {
    generated: {
      label: `Gegenereerde versie ${versionNumber}`,
      color: 'azure' as const,
      icon: <DocumentsIcon style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} />,
    },
    edited: {
      label: `Door jou bewerkt vanaf versie ${versionNumber}`,
      color: 'lime' as const,
      icon: <PencilIcon style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} />,
    },
    unsaved: {
      label: `Versie ${versionNumber} (niet opgeslagen wijzigingen)`,
      color: 'orange' as const,
      icon: <PencilIcon style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} />,
    },
  }

  const { label, color, icon } = config[state]

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      {/* <span style={{ display: 'flex', alignItems: 'center', width: '1rem', height: '1rem' }}>{icon}</span> */}
      {/* this is a dumb hack: the design system doesn't allow for explicit setting of the default color of the badge, green */}
      {color === 'lime' ? <Badge label={label} /> : <Badge color={color} label={label} />}
    </span>
  )
}
