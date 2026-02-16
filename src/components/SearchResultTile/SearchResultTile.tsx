/**
 * @license EUPL-1.2+
 * Copyright Gemeente Amsterdam
 */

import type { HTMLAttributes } from 'react'
import { useId } from 'react'

import { Heading, Paragraph, Icon } from '@amsterdam/design-system-react'
import styles from './SearchResultTile.module.css'

export type SearchResultTileProps = {
  /** The icon component to display */
  icon: React.ComponentType
  /** The heading text */
  heading: string
  /** The description text */
  description: string
  /** Whether the tile is disabled */
  disabled?: boolean
  /** Whether the checkbox is checked */
  checked?: boolean
  /** Callback when checkbox state changes */
  onCheckedChange?: (checked: boolean) => void
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>

export function SearchResultTile({
  icon,
  heading,
  description,
  disabled,
  checked = false,
  onCheckedChange,
  className,
  ...restProps
}: SearchResultTileProps) {
  const checkboxId = useId()

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    onCheckedChange?.(e.target.checked)
  }

  const tileClasses = [styles.tile, disabled && styles['tile--disabled'], className].filter(Boolean).join(' ')

  return (
    <div className={tileClasses} {...restProps}>
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

      <div className={`ams-checkbox ${styles.checkboxWrapper}`}>
        <input
          className="ams-checkbox__input"
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={handleCheckboxChange}
          disabled={disabled}
        />
        <label className="ams-checkbox__label" htmlFor={checkboxId}>
          <span className="ams-checkbox__icon-container" hidden>
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                className="ams-checkbox__rectangle"
                fill="none"
                height="22"
                stroke="black"
                strokeWidth="2"
                width="22"
                x="1"
                y="1"
              />
              <rect
                className="ams-checkbox__hover-indicator"
                fill="none"
                height="20"
                stroke="black"
                strokeWidth="1"
                width="20"
                x="2"
                y="2"
              />
              <path
                className="ams-checkbox__checked-indicator"
                d="M3.251 13.017L8.554 18.761L20.749 5.239"
                fill="none"
                stroke="black"
                strokeWidth="3"
              />
              <line
                className="ams-checkbox__indeterminate-indicator"
                fill="none"
                stroke="black"
                strokeWidth="3"
                x1="4"
                x2="20"
                y1="12"
                y2="12"
              />
            </svg>
          </span>
        </label>
      </div>
    </div>
  )
}
