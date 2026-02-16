'use client'

import {
  ActionGroup,
  Dialog,
  Paragraph,
  Field,
  Button,
  TextInput,
  ErrorMessage,
  Heading,
} from '@amsterdam/design-system-react'
import { SearchResultTile } from '@/components/SearchResultTile'
import { SearchIcon } from '@amsterdam/design-system-react-icons'
import { forwardRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { WandIcon } from '@/components/icons/WandIcon'
import { useEffect } from 'react'
import { useWebsearchSources } from './useWebsearchSources'

interface InternetZoektochtDialogProps {
  onClose: () => void
  onSourcesAdded: () => void
}

export const InternetZoektochtDialog = forwardRef<HTMLDialogElement, InternetZoektochtDialogProps>(
  ({ onClose, onSourcesAdded }, ref) => {
    const searchParams = useSearchParams()
    const flowId = searchParams.get('flowId')

    // Fetch all existing websearch sources
    const { allSources, updateInclusion, mutate: mutateWebsearchSources } = useWebsearchSources(flowId)
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentSearchResults, setCurrentSearchResults] = useState<any[]>([])
    const [statusInfo, setStatusInfo] = useState<any | null>(null)
    const [isPolling, setIsPolling] = useState(false)

    useEffect(() => {
      if (!isPolling || !flowId) return

      let cancelled = false
      let timeoutId: any

      const poll = async () => {
        try {
          const res = await fetch(`/api/flows/websearch/${flowId}/status`, {
            method: 'GET',
            credentials: 'include',
          })

          const data = await res.json().catch(() => ({}))

          if (!res.ok) {
            throw new Error(data.detail || 'Fout bij ophalen status')
          }

          if (cancelled) return

          // status + logs opslaan voor weergave onder de zoekbalk
          setStatusInfo(data)

          const runStatus = data?.run?.status

          if (runStatus === 'succeeded') {
            setIsPolling(false)
            setLoading(false)

            // Als hij klaar is → bronnen ophalen
            const srcRes = await fetch(`/api/flows/websearch/${flowId}/get_sources`, {
              method: 'POST',
              credentials: 'include',
            })

            const srcData = await srcRes.json().catch(() => ({}))

            if (!srcRes.ok) {
              throw new Error(srcData.detail || 'Fout bij ophalen bronnen')
            }

            // Save the sources from this search as current search results
            setCurrentSearchResults(srcData.sources || [])
            // Refresh the websearch sources to get updated data
            await mutateWebsearchSources()
          } else if (runStatus === 'failed') {
            setIsPolling(false)
            setLoading(false)
            setError(data?.run?.error || 'Websearch is mislukt')
          } else {
            // nog bezig → opnieuw pollen over 5 seconden
            timeoutId = setTimeout(poll, 5_000)
          }
        } catch (err: any) {
          if (cancelled) return
          setError(err.message || 'Fout bij ophalen status')
          setIsPolling(false)
          setLoading(false)
        }
      }

      poll()

      return () => {
        cancelled = true
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }, [isPolling, flowId])

    const handleSearch = async () => {
      const searchTerm = searchQuery.trim()

      if (!flowId) {
        setError('Geen flow ID gevonden')
        return
      }

      if (!searchTerm.trim()) {
        setError('Voer een zoekopdracht in')
        return
      }

      setStatusInfo(null)
      setLoading(true)
      setError(null)
      setCurrentSearchResults([])

      try {
        // Make real API call
        console.log('WEBSEARCH!!!')
        const response = await fetch(`/api/flows/websearch/${flowId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ query: searchTerm }),
        })

        const data = await response.json().catch(() => ({}))

        console.log('Websearch API response (start):', data)

        if (!response.ok) {
          throw new Error(data.detail || 'Er is iets misgegaan')
        }

        // Run is gestart → status leegmaken en polling aan
        setStatusInfo({
          run: {
            status: 'running',
            query: searchTerm,
          },
          logs: [],
        })
        setIsPolling(true)
      } catch (err: any) {
        setError(err.message || 'Er is iets misgegaan bij het zoeken')
        setLoading(false)
      }
    }

    const handleCheckboxChange = async (sourceId: string, checked: boolean) => {
      try {
        await updateInclusion(sourceId, checked)
      } catch (err: any) {
        setError(`Fout bij bijwerken van bron: ${err.message}`)
      }
    }

    const handleBackToBronnen = () => {
      // Call the callback to refresh data (sources already saved via API)
      onSourcesAdded()

      // Close the dialog
      onClose()
    }

    return (
      <Dialog
        ref={ref}
        onClose={onClose}
        heading="Zoeken naar internetpagina's (duurt enkele minuten)"
        closeButtonLabel="Sluiten"
      >
        <section>
          <Paragraph className="ams-mb-l">
            Doe een internetzoektocht en vink de websites aan die je als bron wil toevoegen aan de concepttekst. Het
            zoeken duurt enkele minuten, maar is het hopelijk waard :)
          </Paragraph>

          <Field className="ams-mb-l" invalid={Boolean(error)}>
            {statusInfo && (
              <Paragraph className="ams-mb-l" style={{ fontStyle: 'italic', color: 'var(--ams-color-primary-purple)' }}>
                {statusInfo.run ? (
                  <>
                    Status: <strong>{statusInfo.run.status}</strong>
                    {statusInfo.run.num_sources != null && <> — gevonden bronnen: {statusInfo.run.num_sources}</>}
                    {statusInfo.run.error && (
                      <>
                        <br />
                        Fout: {statusInfo.run.error}
                      </>
                    )}
                  </>
                ) : (
                  'Status wordt opgehaald...'
                )}
                {statusInfo.logs && statusInfo.logs.length > 0 && (
                  <>
                    <br />
                    Laatste stap: {statusInfo.logs[statusInfo.logs.length - 1].message}
                  </>
                )}
              </Paragraph>
            )}

            {error && <ErrorMessage id="dialog-internet-search-error">{error}</ErrorMessage>}

            <div style={{ display: 'flex', gap: 'var(--ams-space-s)', width: '100%' }}>
              <TextInput
                id="dialog-internet-search-input"
                placeholder="Voer je zoekopdracht in..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                invalid={Boolean(error)}
                aria-describedby={error ? 'dialog-internet-search-error' : undefined}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button
                variant="secondary"
                className="ams-button--ai-purple"
                icon={<WandIcon style={{ width: '18px', height: '18px' }} />}
                iconBefore
                onClick={handleSearch}
                disabled={loading}
              >
                Zoeken
              </Button>
            </div>
          </Field>

          {/* {(loading || isPolling) && (
            <Paragraph
              className="ams-mb-l"
              style={{ fontStyle: 'italic', color: 'var(--ams-color-primary-purple)' }}
            >
              Bezig met zoeken...
            </Paragraph>
          )} */}

          {/* Current search results */}
          {currentSearchResults.length > 0 && (
            <Field className="ams-mb-m">
              <Heading level={4} className="ams-mb-m">
                Zoekresultaten
              </Heading>
              {currentSearchResults.map((source: any) => {
                // Find the source in allSources to get the include_in_result status
                const existingSource = allSources.find((s) => s.id === source.id)
                return (
                  <SearchResultTile
                    icon={SearchIcon}
                    key={source.id}
                    heading={source.title || 'Er is geen titel voor deze pagina'}
                    description={source.summary || 'Er is geen samenvatting voor deze pagina.'}
                    className="ams-mb-s"
                    checked={existingSource?.include_in_result ?? false}
                    onCheckedChange={(checked) => handleCheckboxChange(source.id, checked)}
                  />
                )
              })}
            </Field>
          )}

          {/* Previous search results - exclude manually added URLs (starting with 'm') */}
          {allSources.filter((source) => source.source_id.startsWith('s')).length > 0 && (
            <Field className="ams-mb-m">
              <Heading level={4} className="ams-mb-m">
                Eerdere zoekresultaten
              </Heading>
              {allSources
                .filter((source) => source.source_id.startsWith('s') && !currentSearchResults.some((s: any) => s.id === source.id))
                .map((source) => (
                  <SearchResultTile
                    icon={SearchIcon}
                    key={source.id}
                    heading={source.title || 'Er is geen titel voor deze pagina'}
                    description={source.summary || 'Er is geen samenvatting voor deze pagina.'}
                    className="ams-mb-s"
                    checked={source.include_in_result}
                    onCheckedChange={(checked) => handleCheckboxChange(source.id, checked)}
                  />
                ))}
            </Field>
          )}
        </section>
        {(currentSearchResults.length > 0 || allSources.filter((s) => s.source_id.startsWith('s')).length > 0) && (
          <section
            style={{
              position: 'sticky',
              bottom: 0,
              backgroundColor: 'white',
              paddingTop: 'var(--ams-space-xl)',
              paddingBottom: 'var(--ams-space-xl)',
              marginTop: 'var(--ams-space-l)',
              marginBottom: 0,
              borderTop: '1px solid var(--ams-color-neutral-grey3)',
              marginLeft: 'calc(-1 * var(--ams-space-l))',
              marginRight: 'calc(-1 * var(--ams-space-l))',
              paddingLeft: 'var(--ams-space-l)',
              paddingRight: 'var(--ams-space-l)',
            }}
          >
            <ActionGroup>
              <Button onClick={handleBackToBronnen}>
                Terug naar bronnen scherm ({allSources.filter((s) => s.source_id.startsWith('s') && s.include_in_result).length}{' '}
                {allSources.filter((s) => s.source_id.startsWith('s') && s.include_in_result).length === 1 ? 'bron' : 'bronnen'} geselecteerd)
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Annuleren
              </Button>
            </ActionGroup>
          </section>
        )}
      </Dialog>
    )
  },
)

InternetZoektochtDialog.displayName = 'InternetZoektochtDialog'
