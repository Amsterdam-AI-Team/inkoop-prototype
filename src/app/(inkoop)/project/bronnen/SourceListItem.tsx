import { Button } from '@amsterdam/design-system-react'
import styles from './SourceListItem.module.css'

interface SourceListItemProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  onDelete: () => void
}

export function SourceListItem({ icon, title, subtitle, onDelete }: SourceListItemProps) {
  return (
    <li className="ams-file-list__item">
      <div className="ams-file-list__item-preview">
        <span className={`ams-icon ams-icon--heading-3 ams-icon--square website-link-icon ${styles.iconWrapper}`}>
          {icon}
        </span>
      </div>
      <div className="ams-file-list__item-info">
        {subtitle ? (
          <>
            <div className={styles.title}>{title}</div>
            <div className={`website-link-url ${styles.subtitle}`}>{subtitle}</div>
          </>
        ) : (
          <div className="website-link-url">{title}</div>
        )}
      </div>
      <div className={styles.deleteButtonWrapper}>
        <Button variant="tertiary" onClick={onDelete}>
          Verwijder
        </Button>
      </div>
    </li>
  )
}
