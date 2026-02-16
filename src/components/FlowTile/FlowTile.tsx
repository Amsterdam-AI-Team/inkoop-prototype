/**
 * @license EUPL-1.2+
 * Copyright Gemeente Amsterdam
 */

import type { HTMLAttributes } from 'react'

import { Heading, Paragraph, Badge } from '@amsterdam/design-system-react'
import NextLink from 'next/link'
import styles from './FlowTile.module.css'

export type FlowTileProps = {
  /** The heading text */
  heading: string
  /** The description text */
  description: string
  /** The status of the tile */
  status?: 'pending' | 'in-progress' | 'done'
  /** Whether the tile is disabled */
  disabled?: boolean
  /** Optional href to make the tile a link */
  href?: string
  /** Optional onClick handler for non-link tiles */
  onClick?: () => void
} & Omit<HTMLAttributes<HTMLDivElement>, 'onClick'>


export function FlowTile({ heading, description, status, disabled, href, onClick, className, ...restProps }: FlowTileProps) {
  const iconColor =
    status === 'done'
      ? 'var(--ams-color-highlight-green)'
      : status === 'in-progress'
        ? 'var(--ams-color-highlight-azure)'
        : 'currentColor'

  const badgeLabel =
    status === 'done' ? 'Klaar' :
    status === 'in-progress' ? 'Bezig' :
    undefined
  const badgeColor = status === 'in-progress' ? 'azure' : undefined

  const isClickable = !disabled && (href || onClick)

  // Build tile class names
  const tileClasses = [
    styles.tile,
    disabled && styles['tile--disabled'],
    isClickable && styles['tile--clickable'],
    !disabled && !isClickable && styles['tile--default'],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const tileContent = (
    <div className={tileClasses} onClick={onClick} {...restProps}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.icon}
        style={{ fill: iconColor }}
      >
        <path d="M16 6H8v2h8zM8 10h8v2H8zM8 14h5.79v2H8z" />
        <path clipRule="evenodd" d="M4 22V2h16v14.21L17.43 22zM18 4H6v16.01h9.56l-1.38-1.55L18 15.63z" fillRule="evenodd" />
      </svg>
      <div className={styles.content}>
        <div className={styles.header}>
          <Heading level={3} size="level-4">
            {heading}
          </Heading>
          {badgeLabel && !disabled && <Badge label={badgeLabel} color={badgeColor} className={styles.badge} />}
        </div>
        <Paragraph size="small" className={styles.description}>
          {description}
        </Paragraph>
      </div>
    </div>
  )

  if (href && !disabled) {
    return (
      <NextLink href={href} className={styles.link}>
        {tileContent}
      </NextLink>
    )
  }

  return tileContent
}
