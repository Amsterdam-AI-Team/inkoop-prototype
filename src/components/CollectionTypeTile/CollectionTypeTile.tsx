/**
 * @license EUPL-1.2+
 * Copyright Gemeente Amsterdam
 */

import type { HTMLAttributes } from 'react'
import { useRouter } from 'next/navigation'

import { Heading, Paragraph, Icon } from '@amsterdam/design-system-react'
import styles from './CollectionTypeTile.module.css'

export type CollectionTypeTileProps = {
  /** The icon component to display */
  icon: React.ComponentType
  /** The heading text */
  heading: string
  /** The description text */
  description: string
  /** Whether the tile is disabled */
  disabled?: boolean
  /** The URL to navigate to when clicked */
  href?: string
} & HTMLAttributes<HTMLDivElement>

export function CollectionTypeTile({
  icon,
  heading,
  description,
  disabled,
  href,
  className,
  onClick,
  ...restProps
}: CollectionTypeTileProps) {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return

    if (onClick) {
      onClick(e)
    }

    if (href && !e.defaultPrevented) {
      router.push(href)
    }
  }

  const tileClasses = [
    styles.tile,
    disabled && styles['tile--disabled'],
    !disabled && (href || onClick) && styles['tile--clickable'],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={tileClasses} onClick={handleClick} {...restProps}>
      <div className={styles.content}>
        <div>
          <Icon svg={icon} size="heading-2" className={styles.icon} />
        </div>
        <div>
          <Heading level={3} size="level-4" className="ams-mb-xs">
            {heading}
          </Heading>
          <Paragraph size="small" className={styles.description}>
            {description}
          </Paragraph>
        </div>
      </div>
    </div>
  )
}
