'use client'

import { useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Grid,
  Heading,
  Paragraph,
  FileInput,
  Field,
  Label,
  Button,
  FileList,
  Icon,
  Row,
  TextInput,
  ErrorMessage,
  Alert,
} from '@amsterdam/design-system-react'
import { SearchIcon, DocumentsIcon } from '@amsterdam/design-system-react-icons'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'
import { ProjectSteps } from '@/components/ProjectSteps'
import { WandIcon } from '@/components/icons/WandIcon'
import { urlSchema, normalizeUrl } from '@/lib/validation/schemas'
import { JurisprudentieDialog } from './JurisprudentieDialog'
import { InternetZoektochtDialog } from './InternetZoektochtDialog'
import { SourceListItem } from './SourceListItem'
import { useDocuments } from '@/hooks/useInkoopData'
import { useFileUpload } from './useFileUpload'
import { useWebsearchSources } from './useWebsearchSources'
import { useFlowMutations } from '@/hooks/useFlowMutations'
import { triggerRun, useRuns } from '@/hooks/useRuns'
import styles from './page.module.css'

export default function BronnenPage() {
  const searchParams = useSearchParams()
  const flowId = searchParams.get('flowId')
  const collectionId = searchParams.get('collectionId')

  // Fetch existing documents from backend
  const { documents, isLoading: documentsLoading, mutate: mutateDocuments } = useDocuments(flowId)

  // Fetch existing runs to determine version number
  const { runs } = useRuns(flowId)

  // File upload logic
  const { files, fileError, setFileError, handleFileChange, handleDeleteFile, handleDeleteUploadedDocument } =
    useFileUpload(flowId, documents, mutateDocuments)

  // Fetch websearch sources from backend
  const {
    sources: websearchSources,
    allSources,
    updateInclusion,
    mutate: mutateWebsearchSources,
  } = useWebsearchSources(flowId)

  // Flow mutations for status updates
  const { markFlowInProgress } = useFlowMutations(flowId)

  const router = useRouter()

  const [websiteLinkInput, setWebsiteLinkInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [isAddingUrl, setIsAddingUrl] = useState(false)
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const jurisprudentieDialogRef = useRef<HTMLDialogElement>(null)
  const internetZoektreekDialogRef = useRef<HTMLDialogElement>(null)

  const handleOpenJurisprudentieDialog = () => {
    if (jurisprudentieDialogRef.current) {
      jurisprudentieDialogRef.current.showModal()
    }
  }

  const handleCloseJurisprudentieDialog = () => {
    if (jurisprudentieDialogRef.current) {
      jurisprudentieDialogRef.current.close()
    }
  }

  const handleOpenInternetZoektreekDialog = () => {
    if (internetZoektreekDialogRef.current) {
      internetZoektreekDialogRef.current.showModal()
    }
  }

  const handleCloseInternetZoektreekDialog = () => {
    if (internetZoektreekDialogRef.current) {
      internetZoektreekDialogRef.current.close()
    }
  }

  const handleAddWebsiteLink = async () => {
    const trimmedUrl = websiteLinkInput.trim()

    // Reset error
    setUrlError(null)

    // Check if empty
    if (!trimmedUrl) {
      setUrlError('URL mag niet leeg zijn')
      return
    }

    // Normalize URL (add https:// if missing)
    const normalizedUrl = normalizeUrl(trimmedUrl)

    // Validate URL format using urlSchema
    const validation = urlSchema.safeParse(normalizedUrl)
    if (!validation.success) {
      setUrlError(validation.error.issues[0].message)
      return
    }

    // Check for duplicates in existing sources
    if (websearchSources.some((source) => source.url === normalizedUrl)) {
      setUrlError('Deze URL is al toegevoegd')
      return
    }

    if (!flowId) {
      setUrlError('Geen flow ID gevonden')
      return
    }

    // Call API to add URL
    setIsAddingUrl(true)
    try {
      const response = await fetch(`/api/flows/${flowId}/websearch/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ urls: [normalizedUrl] }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Toevoegen mislukt' }))
        throw new Error(errorData.detail || 'Toevoegen mislukt')
      }

      const data = await response.json()

      // Set include_in_result to true for the newly added source(s)
      if (data.sources && data.sources.length > 0) {
        // First refresh the sources list so new sources are in the cache
        await mutateWebsearchSources()

        // Then update their inclusion status
        for (const source of data.sources) {
          await updateInclusion(source.id, true)
        }
        // Update flow status to in-progress after adding sources
        await markFlowInProgress()
      }

      // Clear input
      setWebsiteLinkInput('')
    } catch (err: any) {
      setUrlError(err.message || 'Er is iets misgegaan bij het toevoegen')
      console.error('Error adding URL:', err)
    } finally {
      setIsAddingUrl(false)
    }
  }

  const handleSourcesAdded = async () => {
    // Sources are already added via the dialog's checkbox API calls
    // Just refresh the data to show the newly included sources
    await mutateWebsearchSources()
    // Update flow status to in-progress after adding sources
    await markFlowInProgress()
  }

  const handleDeleteSource = async (sourceId: string) => {
    // Call API to set include_in_result to false
    await updateInclusion(sourceId, false)
  }

  const handleGenerateConceptText = async () => {
    if (!flowId || !collectionId) return

    setIsGeneratingConcept(true)
    setGenerateError(null)

    // Trigger the run
    try {
      await triggerRun(flowId)
      // Navigate to concepttekst page only if successful
      router.push(`/project/concepttekst?flowId=${flowId}&collectionId=${collectionId}`)
    } catch (error: any) {
      console.error('Failed to trigger run:', error)
      setGenerateError(error.message || 'Er is een fout opgetreden bij het starten van de tekst generatie.')
      setIsGeneratingConcept(false)
    }
  }

  return (
    <Grid paddingVertical="large">
      <CenteredInkoopPage>
        <div style={{ display: 'flex', justifyContent: 'center' }} className="ams-mb-l">
          <ProjectSteps />
        </div>
        <div className="inkoop-white-background">
          <section className="ams-mb-xl">
            <Row gap="small">
              <Icon svg={DocumentsIcon}></Icon>
              <Paragraph size="large">Bronnen</Paragraph>
            </Row>{' '}
            <Heading level={2} className="ams-mb-m">
              Bronnen toevoegen
            </Heading>
            <Paragraph>
              Je kan hier documenten en websites toevoegen die gebruikt kunnen worden bij het genereren van een concept
              tekst. Hoe relevanter de bronnen, hoe beter de gegenereerde tekst aansluit bij jouw wensen.
            </Paragraph>
          </section>
          <section className="ams-mb-2xl">
            <Field className="ams-mb-2xl" invalid={Boolean(fileError)}>
              <Label className="ams-mb-m" htmlFor="file-input" hint="ondersteund: Word, Excel, PDF, en .txt bestanden">
                Voeg bestanden toe
              </Label>
              {/* <Paragraph id="file-input-description"> 
                </Paragraph> */}

              {fileError && (
                <ErrorMessage id="file-input-error" className={styles.errorMessage}>
                  {fileError}
                </ErrorMessage>
              )}
              <FileInput
                id="file-input"
                className="ams-mb-l"
                multiple
                onChange={handleFileChange}
                accept=".docx, .xlsx, .pdf, .txt"
                aria-describedby={`file-input-description${fileError ? ' file-input-error' : ''}`}
              />
              {documentsLoading && (
                <Paragraph className="ams-mt-m" size="small">
                  Documenten laden...
                </Paragraph>
              )}
              {((documents && documents.length > 0) || files.length > 0) && (
                <>
                  <Heading level={4}>Toegevoegde bestanden</Heading>
                  <FileList className={`ams-mt-m ${styles.fileListWrapper}`}>
                    {/* Show uploaded documents from backend */}
                    {documents?.map((doc) => {
                      // Create a File-like object with the correct size
                      const fileBlob = new Blob([], { type: doc.mime_type })
                      const file = new File([fileBlob], doc.title, { type: doc.mime_type })
                      // Manually set size property (hack to show correct size)
                      Object.defineProperty(file, 'size', {
                        value: doc.original_size_bytes,
                        writable: false,
                      })
                      return (
                        <FileList.Item
                          key={doc.id}
                          file={file}
                          onDelete={() => handleDeleteUploadedDocument(doc.id, doc.title)}
                        />
                      )
                    })}
                    {/* Show local files being uploaded */}
                    {files.map((file, index) => (
                      <FileList.Item
                        key={`${file.name}-${index}`}
                        file={file}
                        onDelete={() => handleDeleteFile(file)}
                      />
                    ))}
                  </FileList>
                </>
              )}
            </Field>
            <Field className="ams-mb-xl" invalid={Boolean(urlError)}>
              <Label htmlFor="website-link-input-main" className="ams-mb-m">
                Voeg websites toe
              </Label>
              <Paragraph id="website-description" className="ams-mb-s">
                Je kan direct een link toevoegen, maar ook websites zoeken via een zoekopdracht (bijv. "Jurisprudentie
                over aanbestedingen gemeente Amsterdam").
              </Paragraph>
              {urlError && <ErrorMessage id="website-link-error">{urlError}</ErrorMessage>}
              <Button
                variant="secondary"
                className={`ams-button--ai-purple ams-mb-s`}
                icon={<WandIcon style={{ width: '18px', height: '18px' }} />}
                iconBefore
                onClick={handleOpenInternetZoektreekDialog}
              >
                Websites toevoegen via zoekopdracht
              </Button>
              <div className={styles.websiteLinksInputGroup}>
                <TextInput
                  id="website-link-input-main"
                  placeholder="Of voeg je eigen link toe (bijv. website.nl/artikel)"
                  type="url"
                  value={websiteLinkInput}
                  onChange={(e) => setWebsiteLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddWebsiteLink()
                    }
                  }}
                  invalid={Boolean(urlError)}
                  aria-describedby={urlError ? 'website-link-error' : 'website-description'}
                  className={styles.websiteLinksInput}
                />
                <Button variant="secondary" onClick={handleAddWebsiteLink} disabled={isAddingUrl}>
                  {isAddingUrl ? 'Toevoegen...' : 'Toevoegen'}
                </Button>
              </div>
            </Field>
            {websearchSources.length > 0 && (
              <Field className="ams-mb-xl">
                {/* Separate manual and search sources */}
                {websearchSources.filter((source) => source.source_id.startsWith('m')).length > 0 && (
                  <div className={`${styles.fileListWrapper} ams-mb-l`}>
                    <Heading level={4}>Handmatig toegevoegde websites</Heading>
                    <ul className="ams-file-list">
                      {websearchSources
                        .filter((source) => source.source_id.startsWith('m'))
                        .map((source) => (
                          <SourceListItem
                            key={source.id}
                            icon={<SearchIcon />}
                            title={source.title}
                            subtitle={source.url}
                            onDelete={() => handleDeleteSource(source.id)}
                          />
                        ))}
                    </ul>
                  </div>
                )}
                {websearchSources.filter((source) => source.source_id.startsWith('s')).length > 0 && (
                  <div className={`${styles.fileListWrapper} ams-mb-l`}>
                    <Heading level={4}>Met zoeken toegevoegde websites</Heading>
                    <ul className="ams-file-list">
                      {websearchSources
                        .filter((source) => source.source_id.startsWith('s'))
                        .map((source) => (
                          <SourceListItem
                            key={source.id}
                            icon={<SearchIcon />}
                            title={source.title}
                            subtitle={source.url}
                            onDelete={() => handleDeleteSource(source.id)}
                          />
                        ))}
                    </ul>
                  </div>
                )}
              </Field>
            )}
          </section>
          <section>
            {generateError && (
              <Alert severity="error" heading="Fout bij starten tekst generatie" headingLevel={4} className="ams-mb-m">
                <Paragraph>{generateError}</Paragraph>
              </Alert>
            )}
            <div className={styles.fullWidthLink}>
              <Button
                className={`ams-button--ai-purple ${styles.fullWidthButton}`}
                icon={<WandIcon style={{ width: '18px', height: '18px' }} />}
                iconBefore
                onClick={handleGenerateConceptText}
                disabled={isGeneratingConcept}
              >
                <strong>
                  {isGeneratingConcept
                    ? 'Concept voorbereiden...'
                    : runs && runs.filter((r) => r.status === 'succeeded').length > 0
                      ? `Schrijf concepttekst ${runs.filter((r) => r.status === 'succeeded').length + 1}`
                      : 'Naar volgende stap: schrijf concepttekst'}
                </strong>
              </Button>
            </div>
          </section>
        </div>
      </CenteredInkoopPage>

      <JurisprudentieDialog ref={jurisprudentieDialogRef} onClose={handleCloseJurisprudentieDialog} />

      <InternetZoektochtDialog
        ref={internetZoektreekDialogRef}
        onClose={handleCloseInternetZoektreekDialog}
        onSourcesAdded={handleSourcesAdded}
      />

      {process.env.NEXT_PUBLIC_DUMMYSEARCH === 'true' && (
        <CenteredInkoopPage>
          <div className={styles.debugContainer}>
            <Heading level={3} className="ams-mb-m">
              Debug: State Overview (NEXT_PUBLIC_DUMMYSEARCH=true)
            </Heading>
            <div className={styles.debugContent}>
              <div>
                <strong>Files ({files.length}):</strong>
                <pre className={styles.debugPre}>
                  {JSON.stringify(
                    files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div>
                <strong>All Website Sources ({allSources.length}):</strong>
                <pre className={styles.debugPre}>{JSON.stringify(allSources, null, 2)}</pre>
              </div>
              <div>
                <strong>Included Website Sources ({websearchSources.length}):</strong>
                <pre className={styles.debugPre}>{JSON.stringify(websearchSources, null, 2)}</pre>
              </div>
            </div>
          </div>
        </CenteredInkoopPage>
      )}
    </Grid>
  )
}
