import { Heading } from '@amsterdam/design-system-react'
import {
  DocumentIcon,
  SearchIcon,
} from '@amsterdam/design-system-react-icons'
import { BronnenTile } from '@/components/BronnenTile'
import styles from './SourcesList.module.css'

interface Document {
  id: string
  title: string
  original_filename: string
}

interface WebsearchSource {
  id: string
  url: string
  title: string
  summary: string | null
}

interface SourcesListProps {
  documents?: Document[]
  websearchSources?: WebsearchSource[]
}

export const SourcesList = ({ documents = [], websearchSources = [] }: SourcesListProps) => {
  // Combine all sources
  const allSources = [
    ...documents.map(doc => ({
      id: doc.id,
      type: 'document' as const,
      heading: doc.title,
      description: doc.original_filename,
    })),
    ...websearchSources.map(source => ({
      id: source.id,
      type: 'websearch' as const,
      heading: source.title,
      description: source.url,
    })),
  ]

  if (allSources.length === 0) {
    return null
  }

  return (
    <section>
      <Heading level={4} className="ams-mb-m">
        Gebruikte bronnen
      </Heading>
      <div className={styles.sourcesGrid}>
        {allSources.map((source) => (
          <BronnenTile
            key={source.id}
            icon={source.type === 'document' ? DocumentIcon : SearchIcon}
            heading={source.heading}
            description={source.description}
            className={styles.sourceTile}
          />
        ))}
      </div>
    </section>
  )
}
