'use client'

import { useState } from 'react'
import { Grid, Heading, Paragraph, Field, Label, TextArea, Button, Icon, Row } from '@amsterdam/design-system-react'
import { ChevronForwardIcon, DocumentQuestionMarkIcon } from '@amsterdam/design-system-react-icons'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'
import { ProjectSteps } from '@/components/ProjectSteps'

import NextLink from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useFlow } from '@/hooks/useInkoopData'
import { useFlowMutations } from '@/hooks/useFlowMutations'
import { useEffect } from 'react'

export default function FlowPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const searchParams = useSearchParams()
  const flowId = searchParams.get('flowId')
  const collectionId = searchParams.get('collectionId')

  const { flow, isLoading: isLoadingFlow, isError, mutate: mutateFlow } = useFlow(flowId)
  const { markFlowInProgress } = useFlowMutations(flowId)

  const [context, setContext] = useState('')
  const [saving, setSaving] = useState(false)

  // Hydrate when server value changes
  useEffect(() => {
    if (flow) {
      setContext(flow.context_content || '')
    }
  }, [flow?.context_content])

  const loading = isAuthLoading || isLoadingFlow
  const error = isError ? 'Er ging iets mis bij het ophalen van de flow.' : null

  // Don't render any content until authentication is verified
  // if (isAuthLoading) {
  //   return null
  // }

  // Initialize context when flow loads
  const template = flow?.template_content || 'Er is geen template gevonden'

  // PATCH helper – stuurt alleen velden die we willen updaten
  async function patchFlow(updates: { template_content?: string; context_content?: string }) {
    if (!flowId) return
    if (!user) return

    // Optimistisch de SWR-cache bijwerken
    mutateFlow((current) => (current ? { ...current, ...updates } : current), { revalidate: false })

    try {
      setSaving(true)
      const res = await fetch(`/api/flows/${flowId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('Kon flow niet updaten:', body)
        // Rollback op error
        mutateFlow()
        return
      }

      const updated = await res.json()

      // Cache bijwerken met server-respons
      mutateFlow(updated, { revalidate: false })

      // Update flow status to in-progress after successful update
      await markFlowInProgress()
    } catch (err) {
      console.error('Fout bij updaten flow:', err)
      // Rollback op error
      mutateFlow()
    } finally {
      setSaving(false)
    }
  }

  const handleContextBlur = () => {
    if (!flow) return
    if (context !== (flow.context_content || '')) {
      patchFlow({ context_content: context })
    }
  }

  // Fallback als flow niet gevonden of error
  if (!loading && (error || !flow)) {
    return (
      <Grid paddingVertical="large">
        <CenteredInkoopPage>
          <div className="inkoop-white-background">
            <section className="ams-mb-l">
              <Heading level={2} className="ams-mb-s">
                Flow niet gevonden
              </Heading>
              <Paragraph>{error || `De flow met id "${flowId}" kon niet worden geladen.`}</Paragraph>
            </section>
          </div>
        </CenteredInkoopPage>
      </Grid>
    )
  }

  return (
    <Grid paddingVertical="large">
      <CenteredInkoopPage>
        <div style={{ display: 'flex', justifyContent: 'center' }} className="ams-mb-l">
          <ProjectSteps />
        </div>
        <div className="inkoop-white-background">
          <section className="ams-mb-xl">
            {loading ? (
              <Paragraph size="large">Flow wordt geladen…</Paragraph>
            ) : (
              <>
                <Paragraph size="large"></Paragraph>
                <Row gap="small">
                  <Icon svg={DocumentQuestionMarkIcon}></Icon>
                  <Paragraph size="large">Wat moet het taalmodel schrijven?</Paragraph>
                </Row>
                {/* Instructie bij de {`${flow?.name.charAt(0).toUpperCase()}${flow?.name.slice(1) ?? 'Naamloze flow'}`} */}
                <Heading level={2} className="ams-mb-s">
                  De instructie voor het schrijven van het hoofdstuk
                </Heading>
                <Paragraph className='ams-mb-xl' id="context-description">
                  Op deze pagina kun je de instructies bekijken die het AI-model meekrijgt bij het schrijven van dit
                  hoofdstuk. Je kunt hier ook extra instructies toevoegen die specifiek zijn voor jouw project.
                </Paragraph>
                <Field className="ams-mb-xl">
                  <Label htmlFor="template-input">Standaardinstructie (altijd meegegeven)</Label>
                  {/* <Paragraph id="template-description">
                    Dit is de standaard instructie die het AI-model meekrijgt.
                    </Paragraph> */}
                  <TextArea
                    aria-describedby="template-description"
                    id="template-input"
                    rows={10}
                    value={template}
                    disabled
                  />
                </Field>
                <Field className="ams-mb-xl">
                  <Label htmlFor="context-input" hint="Optioneel">
                    Jouw extra instructies
                  </Label>
                  <Paragraph id="context-description">
                    Vertel hier waar het taalmodel op moet letten bij het schrijven van dit hoofdstuk, in aanvulling op
                    de standaardinstructie.
                  </Paragraph>
                  <TextArea
                    aria-describedby="context-description"
                    id="context-input"
                    rows={6}
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    onBlur={handleContextBlur}
                    disabled={saving}
                    placeholder="Bijvoorbeeld: 'Let bij dit hoofdstuk op duurzaamheid en een heldere probleemuitwerking.'"
                  />
                </Field>
              </>
            )}
          </section>
          <section className="ams-mb-l">
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <NextLink href={`/project/bronnen?flowId=${flowId}&collectionId=${collectionId}`}>
                <Button icon={<ChevronForwardIcon />}>Naar volgende stap: bronnen toevoegen</Button>
              </NextLink>
            </div>
          </section>
        </div>
      </CenteredInkoopPage>
    </Grid>
  )
}
