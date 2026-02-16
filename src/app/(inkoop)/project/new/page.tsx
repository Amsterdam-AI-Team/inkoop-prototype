'use client'

import { useEffect, useState } from 'react'
import { Grid, Heading, Alert, Paragraph, Button, UnorderedList } from '@amsterdam/design-system-react'
import { useRouter } from 'next/navigation'

import { ConnectedCirclesIcon, DocumentIcon } from '@amsterdam/design-system-react-icons'
import { CollectionTypeTile } from '@/components/CollectionTypeTile/CollectionTypeTile'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'
import { useAuth } from '@/contexts/AuthContext'

const ICON_MAP: Record<string, typeof ConnectedCirclesIcon> = {
  inkoopstrategie: ConnectedCirclesIcon,
  leidraad: DocumentIcon,
}

type DbCollectionTemplate = {
  id: string
  type: string
  display_name: string
  description: string
  enabled: boolean
}

export default function NewProjectPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [templates, setTemplates] = useState<DbCollectionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.is_admin ?? false

  const fetchTemplates = () => {
    setLoading(true)
    setError(null)

    fetch('/api/admin/collection-templates')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Kon templates niet laden')
        }
        return res.json()
      })
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        setError(err.message || 'Er ging iets mis bij het laden van templates')
        setTemplates([])
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  // Loading state
  if (loading) {
    return (
      <Grid paddingVertical="large">
        <CenteredInkoopPage>
          <div className="inkoop-white-background">
            <Paragraph>Templates worden geladen...</Paragraph>
          </div>
        </CenteredInkoopPage>
      </Grid>
    )
  }

  // Error state
  if (error) {
    return (
      <Grid paddingVertical="large">
        <CenteredInkoopPage>
          <div className="inkoop-white-background">
            <Alert severity="error" heading="Templates laden mislukt" headingLevel={3} className="ams-mb-m">
              <Paragraph className="ams-mb-s">{error}</Paragraph>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <Button onClick={fetchTemplates} variant="primary">
                  Opnieuw proberen
                </Button>
                <Button onClick={() => router.push('/')} variant="secondary">
                  Terug naar home
                </Button>
              </div>
            </Alert>
          </div>
        </CenteredInkoopPage>
      </Grid>
    )
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <Grid paddingVertical="large">
        <CenteredInkoopPage>
          <div className="inkoop-white-background">
            <Alert severity="warning" heading="Nog geen templates beschikbaar" headingLevel={3} className="ams-mb-m">
              <Paragraph className="ams-mb-s">
                Er zijn nog geen document templates ingesteld.
              </Paragraph>
              {isAdmin ? (
                <>
                  <Paragraph className="ams-mb-m">
                    Als beheerder kun je:
                  </Paragraph>
                  <UnorderedList className="ams-mb-m">
                    <UnorderedList.Item>Standaard templates laden via het beheerpaneel</UnorderedList.Item>
                    <UnorderedList.Item>Handmatig nieuwe templates aanmaken</UnorderedList.Item>
                  </UnorderedList>
                  <Button onClick={() => router.push('/admin')} variant="primary">
                    Naar beheerpaneel
                  </Button>
                </>
              ) : (
                <Paragraph>
                  Neem contact op met een beheerder om templates te configureren.
                </Paragraph>
              )}
            </Alert>
          </div>
        </CenteredInkoopPage>
      </Grid>
    )
  }

  // Success state - show templates
  return (
    <Grid paddingVertical="large">
      <CenteredInkoopPage>
        <div className="inkoop-white-background">
          <Heading level={2} className="ams-mb-xl">
            Kies het soort project dat je wil starten
          </Heading>
          {templates.map((t) => (
            <CollectionTypeTile
              key={t.type}
              icon={ICON_MAP[t.type] ?? ConnectedCirclesIcon}
              heading={t.display_name}
              description={t.description}
              href={`/project/new/${t.type}`}
              className="ams-mb-s"
              disabled={!t.enabled}
            />
          ))}
        </div>
      </CenteredInkoopPage>
    </Grid>
  )
}
