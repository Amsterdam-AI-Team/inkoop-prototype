'use client'

import { use, useState, useEffect } from 'react'
import { Grid, Paragraph, Row, Icon, Alert, Button } from '@amsterdam/design-system-react'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'

import { ConnectedCirclesIcon } from '@amsterdam/design-system-react-icons'
import { FlowTile } from '@/components/FlowTile/FlowTile'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'
import { EditableProjectTitle } from '@/components/EditableProjectTitle'
import { STANDARD_CHECKBOXES } from '@/lib/templates'
import { useAuth } from '@/contexts/AuthContext'

interface NewProjectPageProps {
  params: Promise<{
    collection_type: string
  }>
}

type DbFlowTemplate = {
  id: string
  name: string
  description: string
  template_name: string
  template_content: string
  sort_order: number
}

type DbCollectionTemplate = {
  id: string
  type: string
  display_name: string
  description: string
  template_content: string | null
  enabled: boolean
  flows: DbFlowTemplate[]
}

export default function NewProjectPage({ params }: NewProjectPageProps) {
  const resolvedParams = use(params)
  const { collection_type } = resolvedParams
  const router = useRouter()
  const { user } = useAuth()

  const [projectTitle, setProjectTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dbTemplate, setDbTemplate] = useState<DbCollectionTemplate | null>(null)
  const [dbLoaded, setDbLoaded] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const isAdmin = user?.is_admin ?? false

  // Fetch collection template from database
  useEffect(() => {
    fetch('/api/admin/collection-templates')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Kon templates niet laden')
        }
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const match = data.find((t: DbCollectionTemplate) => t.type === collection_type)
          if (match) {
            setDbTemplate(match)
            setFetchError(null)
          } else {
            setFetchError(`Template type "${collection_type}" niet gevonden`)
          }
        }
      })
      .catch((err) => {
        setFetchError(err.message || 'Er ging iets mis bij het laden van templates')
      })
      .finally(() => {
        setDbLoaded(true)
      })
  }, [collection_type])

  // Show nothing while loading
  if (!dbLoaded) {
    return (
      <Grid paddingVertical="large">
        <CenteredInkoopPage>
          <div className="inkoop-white-background">
            <Paragraph>Template wordt geladen...</Paragraph>
          </div>
        </CenteredInkoopPage>
      </Grid>
    )
  }

  // Error state - template not found or fetch failed
  if (fetchError || !dbTemplate) {
    return (
      <Grid paddingVertical="large">
        <CenteredInkoopPage>
          <div className="inkoop-white-background">
            <Alert severity="error" heading="Template niet gevonden" headingLevel={3} className="ams-mb-m">
              <Paragraph className="ams-mb-s">
                {fetchError || `Template type "${collection_type}" bestaat niet in de database.`}
              </Paragraph>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <Button onClick={() => router.push('/project/new')} variant="primary">
                  Terug naar overzicht
                </Button>
                {isAdmin && (
                  <Button onClick={() => router.push('/admin')} variant="secondary">
                    Naar beheerpaneel
                  </Button>
                )}
              </div>
            </Alert>
          </div>
        </CenteredInkoopPage>
      </Grid>
    )
  }

  // Derive display values from DB template
  const displayName = dbTemplate.display_name
  const description = dbTemplate.description
  const flows = dbTemplate.flows.map((f) => ({
    name: f.name,
    description: f.description,
    template_name: f.template_name,
    template_content: f.template_content,
  }))

  // Empty flows state
  if (flows.length === 0) {
    return (
      <Grid paddingVertical="large">
        <CenteredInkoopPage>
          <div className="inkoop-white-background">
            <Alert severity="warning" heading="Geen hoofdstukken beschikbaar" headingLevel={3} className="ams-mb-m">
              <Paragraph className="ams-mb-s">
                Dit template heeft nog geen hoofdstukken.
                {isAdmin && ' Voeg hoofdstukken toe via het beheerpaneel.'}
              </Paragraph>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <Button onClick={() => router.push('/project/new')} variant="primary">
                  Terug
                </Button>
                {isAdmin && (
                  <Button onClick={() => router.push('/admin')} variant="secondary">
                    Naar beheerpaneel
                  </Button>
                )}
              </div>
            </Alert>
          </div>
        </CenteredInkoopPage>
      </Grid>
    )
  }

  const handleTitleChange = (newTitle: string) => {
    setProjectTitle(newTitle)
    if (error && newTitle.trim()) {
      setError(null)
    }
  }

  const handleFlowClick = async (clickedFlowTemplate: { name: string; description: string; template_name: string; template_content: string }) => {
    if (!projectTitle.trim()) {
      setError('Vul eerst een projectnaam in')
      return
    }

    if (isCreating) {
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // 1. Create collection
      const collectionRes = await fetch('/api/collections', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectTitle.trim(),
          description: description ?? '',
          template_content: dbTemplate?.template_content ?? null,
        }),
      })

      if (!collectionRes.ok) {
        const errorData = await collectionRes.json().catch(() => ({}))
        throw new Error(`Kon project niet aanmaken: ${errorData.detail || collectionRes.statusText}`)
      }

      const collection = await collectionRes.json()

      // 2. Create ALL flows in parallel
      const flowCreationPromises = flows.map(async (flowTemplate) => {
        const flowRes = await fetch(`/api/collections/${collection.id}/flows`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flowTemplate),
        })

        if (!flowRes.ok) {
          const errorData = await flowRes.json().catch(() => ({}))
          console.error('[NewProject] Flow creation failed for', flowTemplate.name, errorData)
          throw new Error(`Kon hoofdstuk "${flowTemplate.name}" niet aanmaken`)
        }

        const flow = await flowRes.json()

        // 3. Create standard checkboxes for this flow
        const checkboxCreationPromises = STANDARD_CHECKBOXES.map(async (checkbox) => {
          const checkboxRes = await fetch(`/api/flows/${flow.id}/checkboxes`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: checkbox.name }),
          })

          if (!checkboxRes.ok) {
            console.error('[NewProject] Checkbox creation failed for', checkbox.name)
          }

          return checkboxRes.ok ? checkboxRes.json() : null
        })

        await Promise.all(checkboxCreationPromises)

        return flow
      })

      const createdFlows = await Promise.all(flowCreationPromises)

      // 4. Find the flow that was clicked to navigate to it
      const clickedFlow = createdFlows.find(
        (flow) => flow.template_name === clickedFlowTemplate.template_name
      )

      if (!clickedFlow) {
        throw new Error('Kon geselecteerde hoofdstuk niet vinden')
      }

      // 5. Invalidate collections cache and redirect to the clicked flow instruction page
      mutate('/api/collections')
      router.push(`/project/instructie?flowId=${clickedFlow.id}&collectionId=${collection.id}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Er ging iets mis bij het aanmaken van het project'
      setError(errorMessage)
      console.error('[NewProject] Error:', err)
      setIsCreating(false)
    }
  }

  return (
    <Grid paddingVertical="large">
      <CenteredInkoopPage>
        <div className="inkoop-white-background">
          <section className="ams-mb-l">
            <Row gap="small">
              <Icon svg={ConnectedCirclesIcon} />
              <Paragraph size="large">{displayName} opstellen</Paragraph>
            </Row>
            <EditableProjectTitle
              collectionType={collection_type}
              initialTitle={projectTitle}
              onTitleChange={handleTitleChange}
              placeholder={`Naamloos project`}
            />
            <Paragraph className="ams-mb-l">{description}</Paragraph>

            {error && <Paragraph className="ams-mb-m" style={{ color: 'red' }}>{error}</Paragraph>}

            {isCreating && <Paragraph className="ams-mb-m">Project wordt aangemaakt...</Paragraph>}

            {flows.map((flow, index) => (
              <FlowTile
                key={index}
                heading={flow.name}
                description={flow.description}
                className="ams-mb-s"
                status="pending"
                onClick={() => handleFlowClick(flow)}
                disabled={isCreating || !projectTitle.trim()}
              />
            ))}
          </section>
        </div>
      </CenteredInkoopPage>
    </Grid>
  )
}
