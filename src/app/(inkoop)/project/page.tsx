'use client'
import { Grid, Paragraph, Row, Icon, Button, ActionGroup, Dialog } from '@amsterdam/design-system-react'
import { mutate } from 'swr'

import { ConnectedCirclesIcon, DownloadIcon } from '@amsterdam/design-system-react-icons'
import { FlowTile } from '@/components/FlowTile/FlowTile'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'
import { EditableProjectTitle } from '@/components/EditableProjectTitle/EditableProjectTitle'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { capitalize } from '@/utils/string'
import { useCollection, useFlows } from '@/hooks/useInkoopData'
import { useRef, useState } from 'react'

export default function ProjectPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const collectionId = searchParams.get('collectionId')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const [selectedFlow, setSelectedFlow] = useState<{ id: string; name: string } | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use SWR hooks for data fetching with automatic caching and deduplication
  const { collection: collectionMetaData, mutate: mutateCollection } = useCollection(collectionId)
  const { flows, isLoading: isLoadingFlows, isError, mutate: mutateFlows } = useFlows(collectionId)

  const loading = isAuthLoading || isLoadingFlows
  const error = isError ? 'Er ging iets mis bij het ophalen van gegevens.' : null

  // Check if all flows are completed
  const allFlowsCompleted = flows && flows.length > 0 && flows.every((flow) => flow.status === 'done')

  // Don't render any content until authentication is verified
  if (isAuthLoading) {
    return null
  }

  const projectKind = 'Inkoopstrategie'

  const handleTitleChange = async (newTitle: string) => {
    if (!collectionId) {
      console.warn('Geen collectionId beschikbaar in de URL, kan titel niet updaten.')
      return
    }

    if (!user) {
      console.warn('Geen geldige sessie, kan titel niet updaten.')
      return
    }

    // Optimistically update the cache immediately
    mutateCollection((current) => (current ? { ...current, name: newTitle } : current), { revalidate: false })

    try {
      // Perform the API call
      const res = await fetch(`/api/collections/${collectionId}`, {
        body: JSON.stringify({ name: newTitle }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('Kon collection titel niet updaten:', body)
        // Rollback on error by revalidating
        mutateCollection()
        return
      }

      const updatedCollection = await res.json()

      // Update the cache with the server response
      mutateCollection(updatedCollection, { revalidate: false })
    } catch (err) {
      console.error('Fout bij updaten collection titel:', err)
      // Rollback on error by revalidating
      mutateCollection()
    }
  }

  const handleFlowClick = (flow: { id: string; name: string; status?: string }) => {
    if (flow.status === 'done') {
      setSelectedFlow({ id: flow.id, name: flow.name })
      dialogRef.current?.showModal()
    } else {
      router.push(`/project/instructie?flowId=${flow.id}&collectionId=${collectionId}`)
    }
  }

  const handleReopenChapter = async () => {
    if (!selectedFlow) return

    try {
      const response = await fetch(`/api/flows/${selectedFlow.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'in-progress' }),
      })

      if (!response.ok) {
        throw new Error('Failed to reopen chapter')
      }

      // Refresh flows data
      mutateFlows()

      dialogRef.current?.close()
      router.push(`/project/concepttekst?flowId=${selectedFlow.id}&collectionId=${collectionId}`)
    } catch (error) {
      console.error('Failed to reopen chapter:', error)
    }
  }

  const handleDownload = async () => {
    if (!collectionId || isDownloading) return

    setIsDownloading(true)

    try {
      const response = await fetch(`/api/collections/${collectionId}/export`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Download mislukt')
      }

      // Get the filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `Inkoopstrategie_${new Date().toISOString().split('T')[0]}.docx`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert(`Download mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDeleteClick = () => {
    deleteDialogRef.current?.showModal()
  }

  const handleDeleteConfirm = async () => {
    if (!collectionId || isDeleting) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Verwijderen mislukt')
      }

      // Invalidate collections cache
      mutate('/api/collections')

      // Redirect to home page
      router.push('/')
    } catch (error) {
      console.error('Delete error:', error)
      alert(`Verwijderen mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`)
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <Grid paddingVertical="large">
        <CenteredInkoopPage>
          <div className="inkoop-white-background">
            <section className="ams-mb-l">
              <Row gap="small">
                <Icon svg={ConnectedCirclesIcon} />
                <Paragraph size="large">{projectKind} opstellen</Paragraph>
              </Row>
              <EditableProjectTitle
                collectionType={projectKind}
                initialTitle={collectionMetaData?.name}
                onTitleChange={handleTitleChange}
                placeholder="Project titel"
              />
              {/* <Paragraph className="ams-mb-xl">
                {collectionMetaData && collectionMetaData?.description}
              </Paragraph> */}
              {loading && <Paragraph className="ams-mb-l">Flows worden geladen…</Paragraph>}
              {error && !loading && <Paragraph className="ams-mb-l">Er ging iets mis: {error}</Paragraph>}
              {!loading &&
                !error &&
                flows?.map((flow) => (
                  <FlowTile
                    key={flow.id}
                    heading={capitalize(flow.name)}
                    description={flow.description || 'Laat een tekst genereren voor deze stap.'}
                    className="ams-mb-s"
                    href={
                      flow.status === 'done'
                        ? undefined
                        : `/project/instructie?flowId=${flow.id}&collectionId=${collectionId}`
                    }
                    onClick={flow.status === 'done' ? () => handleFlowClick(flow) : undefined}
                    status={flow.status}
                  />
                ))}
            </section>
            <ActionGroup>
              {!allFlowsCompleted && (
                <Button
                  icon={DownloadIcon}
                  iconBefore
                  variant="secondary"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading
                    ? 'Downloaden...'
                    : 'Download tekst van de hoofdstukken die klaar zijn'}
                </Button>
              )}
              {allFlowsCompleted && (
                <Button
                  icon={DownloadIcon}
                  iconBefore
                  variant="primary"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading
                    ? 'Downloaden...'
                    : 'Download tekst van alle hoofdstukken'}
                </Button>
              )}
              <Button variant="tertiary" onClick={handleDeleteClick} disabled={isDeleting}>
                Verwijder project
              </Button>
            </ActionGroup>
          </div>
        </CenteredInkoopPage>
        {/* Dialog for completed chapters */}
        <Dialog ref={dialogRef} heading="Hoofdstuk heropenen">
          <Paragraph className="ams-mb-l">
            Dit hoofdstuk is goedgekeurd en klaar. Wil je het opnieuw openen om wijzigingen te maken?
          </Paragraph>
          <ActionGroup className="ams-mb-l">
            <Button variant="primary" onClick={handleReopenChapter}>
              Hoofdstuk heropenen
            </Button>
            <Button variant="tertiary" onClick={() => dialogRef.current?.close()}>
              Annuleren
            </Button>
          </ActionGroup>
        </Dialog>

        {/* Dialog for delete confirmation */}
        <Dialog ref={deleteDialogRef} heading="Project verwijderen">
          <Paragraph className="ams-mb-l">
            Weet je zeker dat je dit project wilt verwijderen? Alle hoofdstukken en bijbehorende gegevens worden
            permanent verwijderd.
          </Paragraph>
          <ActionGroup className="ams-mb-l">
            <Button variant="primary" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Bezig met verwijderen...' : 'Ja, verwijderen'}
            </Button>
            <Button variant="tertiary" onClick={() => deleteDialogRef.current?.close()} disabled={isDeleting}>
              Annuleren
            </Button>
          </ActionGroup>
        </Dialog>
      </Grid>
    </div>
  )
}
