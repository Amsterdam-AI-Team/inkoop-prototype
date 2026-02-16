/**
 * @license EUPL-1.2+
 * Copyright Gemeente Amsterdam
 */

import type { HTMLAttributes } from 'react'
import { Heading, Paragraph, Icon } from '@amsterdam/design-system-react'
import styles from './BronnenTile.module.css'

export type BronnenTileProps = {
  /** The icon component to display */
  icon: React.ComponentType
  /** The heading text */
  heading: string
  /** The description text */
  description: string
  /** Whether the tile is disabled */
  disabled?: boolean
} & HTMLAttributes<HTMLDivElement>

export function BronnenTile({
  icon,
  heading,
  description,
  disabled,
  className,
  style,
  ...restProps
}: BronnenTileProps) {
  const tileClasses = [styles.tile, disabled && styles['tile--disabled'], className].filter(Boolean).join(' ')

  return (
    <div className={tileClasses} style={style} {...restProps}>
      <div className={styles.header}>
        <Icon svg={icon} size="heading-2" className={styles.icon} />
        <Heading level={3} size="level-4" className={styles.heading}>
          {heading}
        </Heading>
      </div>
      <Paragraph size="small" className={styles.description}>
        {description}
      </Paragraph>
    </div>
  )
}
