'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Grid, Paragraph, Button, Alert, Heading, Row, Icon, ActionGroup } from '@amsterdam/design-system-react'
import {
  DocumentWithPencilIcon,
  UndoIcon,
  DocumentWithPencilIcon as EditIcon,
} from '@amsterdam/design-system-react-icons'
import { ConceptEditor } from '@/components/ConceptEditor/ConceptEditor'
import { SourcesList } from '@/components/SourcesList/SourcesList'
import { ApprovalSidebar } from '@/components/ApprovalSidebar/ApprovalSidebar'
import { ProjectSteps } from '@/components/ProjectSteps'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { BadgeState } from '@/components/StatusBadge'
import { useRuns, triggerRun, saveEditedGeneration } from '@/hooks/useRuns'
import { useCollection, useFlow, useDocuments } from '@/hooks/useInkoopData'
import { useCheckboxes } from '@/hooks/useCheckboxes'
import { useWebsearchSources } from '../bronnen/useWebsearchSources'
import { getEditedText, saveEditedText, clearEditedText } from '@/lib/localStorage'
import { capitalize } from '@/utils/string'
import styles from './page.module.css'
import type { MDXEditorMethods } from '@mdxeditor/editor'

/**
 * ARCHITECTURAL NOTE - Future Refactoring Opportunity
 *
 * This component has evolved to handle complex state management between:
 * - Backend runs (generated & edited versions)
 * - localStorage (for persistence & unsaved changes)
 * - Auto-selection logic
 * - Badge state determination
 *
 * Current complexity points:
 * 1. Auto-selection is skipped when localStorage exists, causing selectedRunId to be null
 * 2. Badge state depends on multiple sources: isEdited, isViewingEditedVersion, AND localStorage.edited flag
 * 3. localStorage serves dual purpose: caching saved content AND storing unsaved changes
 * 4. Multiple useEffects managing overlapping concerns (text loading, auto-selection, localStorage sync)
 *
 * Suggested simpler approach for future refactoring:
 * 1. **Single Source of Truth**: Use a state machine or reducer to manage:
 *    - VIEWING_GENERATED | VIEWING_EDITED | EDITING_WITH_UNSAVED_CHANGES
 * 2. **Explicit Version Selection**: Always set selectedRunId on load (no conditional auto-selection)
 * 3. **Clear localStorage Strategy**: Only use localStorage for truly unsaved changes, not as cache
 * 4. **Backend-First Loading**: Always load from backend, then overlay unsaved changes from localStorage
 * 5. **Simplified Badge Logic**: Badge state should be derived directly from the state machine state
 *
 * This would eliminate the current interdependencies and make the component easier to reason about.
 */
export default function ConcepttekstPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const flowId = searchParams.get('flowId')
  const collectionId = searchParams.get('collectionId')

  // Fetch collection and flow data
  const { collection } = useCollection(collectionId)
  const { flow, mutate: mutateFlow } = useFlow(flowId)

  // Fetch runs data
  const { runs, isLoading: runsLoading, isError: runsError, mutate: mutateRuns } = useRuns(flowId)

  // Fetch checkboxes data
  const { checkboxes, toggleCheckbox } = useCheckboxes(flowId)

  // Fetch documents and websearch sources for the sidebar
  const { documents } = useDocuments(flowId)
  const { sources: websearchSources } = useWebsearchSources(flowId)

  const [markdown, setMarkdown] = useState('')
  const [isEdited, setIsEdited] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null) // Format: "runId-generated" or "runId-edited"
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [resetCounter, setResetCounter] = useState(0)
  const [hasLoadedContent, setHasLoadedContent] = useState(false) // Track if we've ever loaded content
  const [isLoadingFromBackend, setIsLoadingFromBackend] = useState(false) // Track if we're loading text from backend
  const isResettingRef = useRef(false)
  const previousLatestRunIdRef = useRef<string | null>(null)
  const hasAutoSelectedRef = useRef(false)
  const editorRef = useRef<MDXEditorMethods>(null)
  const discardDialogRef = useRef<HTMLDialogElement>(null)
  const revertDialogRef = useRef<HTMLDialogElement>(null)

  // Parse selectedRunId to get the actual run ID and version type
  const parseSelectedVersion = (versionId: string | null) => {
    if (!versionId) return { runId: null, isEditedVersion: false }
    const parts = versionId.split('-')
    const isEditedVersion = parts[parts.length - 1] === 'edited'
    const runId = parts.slice(0, -1).join('-')
    return { runId, isEditedVersion }
  }

  const { runId: actualSelectedRunId, isEditedVersion: isViewingEditedVersion } = parseSelectedVersion(selectedRunId)

  // Get selected or latest run and determine state
  const selectedRun = actualSelectedRunId && runs ? runs.find((r) => r.id === actualSelectedRunId) : null

  // Find the most recent successful run (to show content even while a new run is generating)
  const latestSuccessfulRun = runs?.find((r) => r.status === 'succeeded')

  // Use selected run if available, otherwise use the latest successful run (not just latest run)
  // This allows showing previous content while a new generation is in progress
  const latestRun = selectedRun || latestSuccessfulRun

  // Check if there's an actively running generation
  const isActivelyGenerating = runs?.[0]?.status === 'running'

  // Show loading state while:
  // 1. Runs are being fetched, OR
  // 2. We have a successful run but haven't loaded its content yet
  // Don't show loading just because a new run is generating - show previous content instead
  const isLoadingContent = !hasLoadedContent && latestRun?.status === 'succeeded'
  const isGenerating = runsLoading || isLoadingContent
  const hasError = runsError || (!latestSuccessfulRun && runs?.[0]?.status === 'failed')

  // Calculate version number and badge state
  const successfulRuns = runs?.filter((r) => r.status === 'succeeded') || []
  const currentRunIndex = selectedRun ? successfulRuns.findIndex((r) => r.id === selectedRun.id) : 0
  const versionNumber = currentRunIndex >= 0 ? successfulRuns.length - currentRunIndex : 1
  const isViewingLatest = selectedRun?.id === successfulRuns[0]?.id || !selectedRun

  // Check if current run has an edited version
  const currentRunHasEdit = Boolean(selectedRun?.is_user_edited && selectedRun?.edited_response)

  // Determine if we should make the editor read-only
  // Read-only when: viewing old generated version OR viewing generated version that has an edit
  const isReadOnly = Boolean(
    (!isViewingEditedVersion && !isViewingLatest) || (!isViewingEditedVersion && currentRunHasEdit),
  )

  // Determine badge state
  const getBadgeState = (): BadgeState => {
    if (isEdited) return 'unsaved'
    if (isViewingEditedVersion) return 'edited'

    // Check if we're showing saved localStorage content (edited: false means it was saved)
    // Only check for the currently viewing run
    if (flowId && currentRunId) {
      const localStorageData = getEditedText(flowId, currentRunId)
      if (localStorageData && !localStorageData.edited) {
        return 'edited'
      }
    }

    return 'generated'
  }
  const badgeState = getBadgeState()

  // Log version timestamps whenever successful runs change
  useEffect(() => {
    if (!successfulRuns || successfulRuns.length === 0) return

    console.log('📅 Version timestamps:')
    successfulRuns.forEach((run, index) => {
      const versionNumber = successfulRuns.length - index
      const createdAt = new Date(run.created_at).toLocaleString('nl-NL')
      const editedAt = run.edited_at ? new Date(run.edited_at).toLocaleString('nl-NL') : null

      console.log(`  Version ${versionNumber}:`)
      console.log(`    Generated: ${createdAt}`)
      if (run.is_user_edited && editedAt) {
        console.log(`    Edited: ${editedAt}`)
      }
    })
  }, [successfulRuns])

  // Log badge state and related values
  useEffect(() => {
    console.log('🏷️  Badge State Debug:')
    console.log(`  selectedRunId: ${selectedRunId}`)
    console.log(`  isViewingEditedVersion: ${isViewingEditedVersion}`)
    console.log(`  isEdited: ${isEdited}`)
    console.log(`  badgeState: ${badgeState}`)

    if (flowId && currentRunId) {
      const localStorageData = getEditedText(flowId, currentRunId)
      if (localStorageData) {
        console.log(`  localStorage exists: true (for run ${currentRunId})`)
        console.log(`  localStorage savedAt: ${new Date(localStorageData.savedAt).toLocaleString('nl-NL')}`)
      } else {
        console.log(`  localStorage exists: false (for run ${currentRunId})`)
      }
    }
  }, [selectedRunId, isViewingEditedVersion, isEdited, badgeState, flowId])

  // Auto-select the latest run's edited version if it exists, otherwise the generated version
  useEffect(() => {
    if (!runs || runs.length === 0 || selectedRunId || hasAutoSelectedRef.current) {
      return
    }

    // Find the latest SUCCESSFUL run (not just runs[0] which might be running/failed)
    const latestSuccessfulRun = runs.find((r) => r.status === 'succeeded')

    if (latestSuccessfulRun?.status === 'succeeded') {
      // Check if there are unsaved edits in localStorage for the latest run
      const hasLocalStorageEdits = flowId ? !!getEditedText(flowId, latestSuccessfulRun.id) : false

      if (hasLocalStorageEdits) {
        // Don't set selectedRunId - let it be null so localStorage is shown
        hasAutoSelectedRef.current = true
      } else {
        // Always set a selectedRunId to ensure consistency
        if (latestSuccessfulRun.is_user_edited && latestSuccessfulRun.edited_response) {
          setSelectedRunId(`${latestSuccessfulRun.id}-edited`)
        } else {
          setSelectedRunId(`${latestSuccessfulRun.id}-generated`)
        }
        // Mark that we've done the initial auto-selection
        hasAutoSelectedRef.current = true
      }
    }
  }, [runs, selectedRunId, flowId])

  // Clear localStorage for previous run when a new run is detected
  useEffect(() => {
    if (!flowId || !runs || runs.length === 0) return

    const currentLatestId = runs[0].id
    const previousLatestId = previousLatestRunIdRef.current

    // If the latest run has changed (new generation completed), clear localStorage for the old run
    if (previousLatestId && previousLatestId !== currentLatestId) {
      clearEditedText(flowId, previousLatestId)
      // Also clear any version selection to show the new generated text
      setSelectedRunId(null)
      hasAutoSelectedRef.current = false
    }

    // Update the ref to track this run
    previousLatestRunIdRef.current = currentLatestId
  }, [flowId, runs])

  // Load text from selected or latest run
  useEffect(() => {
    if (!flowId) return

    // Use the selected run if available, otherwise use the latest run
    const runToLoad = selectedRun || latestRun

    if (runToLoad?.status === 'succeeded' && runToLoad.id) {
      // Mark that we're loading from backend to prevent localStorage saves
      setIsLoadingFromBackend(true)

      fetch(`/api/flows/${flowId}/runs/${runToLoad.id}`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data) => {
          const generatedText = data.generations?.[0]?.response || ''
          const generationId = data.generations?.[0]?.id || null

          // Use runToLoad instead of data.run because runToLoad comes from the runs list
          // which has the is_user_edited and edited_response fields

          // Always set the generation ID and run ID
          setCurrentGenerationId(generationId)
          setCurrentRunId(runToLoad.id)

          // Determine which text to show
          let textToShow = generatedText
          let shouldMarkAsEdited = false

          console.log('📝 Text Loading Debug:')
          console.log(`  selectedRunId: ${selectedRunId}`)
          console.log(`  isViewingEditedVersion: ${isViewingEditedVersion}`)
          console.log(`  runToLoad has edited_response: ${!!runToLoad.edited_response}`)

          // Check if we're viewing a specific version
          if (isViewingEditedVersion && runToLoad.edited_response) {
            // User selected an edited version
            // Now that localStorage is version-specific, check it for ANY version
            const editedData = getEditedText(flowId, runToLoad.id)
            const backendEditedAt = runToLoad.edited_at ? new Date(runToLoad.edited_at).getTime() : 0
            const localStorageSavedAt = editedData ? new Date(editedData.savedAt).getTime() : 0

            console.log(`  Backend edited_at: ${runToLoad.edited_at}`)
            console.log(`  localStorage savedAt: ${editedData?.savedAt}`)
            console.log(`  localStorage is newer: ${localStorageSavedAt > backendEditedAt}`)

            // If localStorage exists and is newer than the database version, use it
            if (editedData && localStorageSavedAt > backendEditedAt) {
              textToShow = editedData.text
              shouldMarkAsEdited = editedData.edited
              console.log(
                `  Action: Showing LOCALSTORAGE (newer than database), shouldMarkAsEdited = ${editedData.edited}`,
              )
            } else {
              textToShow = runToLoad.edited_response
              shouldMarkAsEdited = false // Not actively editing, just viewing a saved version
              console.log(`  Action: Showing EDITED version from database, shouldMarkAsEdited = false`)
            }
          } else if (!selectedRunId) {
            // No explicit version selected - check for unsaved edits in localStorage for this run
            const editedData = getEditedText(flowId, runToLoad.id)
            if (editedData) {
              textToShow = editedData.text
              // Use the edited flag from localStorage to determine if there are unsaved changes
              shouldMarkAsEdited = editedData.edited
              console.log(`  Action: Showing localStorage text (no explicit selection)`)
              console.log(`  localStorage.edited flag: ${editedData.edited}`)
              console.log(`  shouldMarkAsEdited: ${shouldMarkAsEdited}`)
            }
          } else {
            // Viewing a specific version (generated or edited) - show what was selected
            console.log(
              `  Action: Showing explicitly selected ${isViewingEditedVersion ? 'EDITED' : 'GENERATED'} version`,
            )
          }
          // textToShow is already set to generatedText by default

          setMarkdown(textToShow)
          setIsEdited(shouldMarkAsEdited)
          setHasLoadedContent(true) // Mark that we've loaded content at least once

          // Clear the loading flag after a small delay to ensure state updates propagate
          setTimeout(() => {
            setIsLoadingFromBackend(false)
          }, 50)
        })
        .catch((err) => {
          console.error('Failed to load generated text:', err)
          // Set hasLoadedContent to true even on error to prevent infinite loading
          setHasLoadedContent(true)
          setIsLoadingFromBackend(false)
        })
    }
  }, [
    flowId,
    selectedRunId,
    selectedRun?.id,
    latestRun?.id,
    latestRun?.status,
    isViewingEditedVersion,
    selectedRun,
    latestRun,
  ])

  // Update editor content when markdown changes
  useEffect(() => {
    if (editorRef.current && markdown) {
      editorRef.current.setMarkdown(markdown)
    }
  }, [markdown])

  // Save edited text to localStorage when markdown changes
  useEffect(() => {
    if (!flowId || !markdown) return

    // Skip saving if we're currently resetting
    if (isResettingRef.current) {
      console.log('💾 Skipping localStorage save - currently resetting')
      return
    }

    // CRITICAL: Skip saving if we're loading from backend (prevents race condition overwrite)
    if (isLoadingFromBackend) {
      console.log('💾 Skipping localStorage save - loading from backend')
      return
    }

    // Now that localStorage is version-specific (keyed by runId), we can save for ANY version
    // Each version has its own localStorage blob, so they won't interfere with each other

    // Only save if text has been set (not initial empty state)
    if (markdown.trim() && currentRunId) {
      // Check if localStorage already has the same content for this run
      const existingData = getEditedText(flowId, currentRunId)
      const contentChanged = !existingData || existingData.text !== markdown

      // Only save if content has actually changed
      if (contentChanged) {
        saveEditedText(flowId, currentRunId, markdown, isEdited)
        // Log localStorage savedAt timestamp
        const savedData = getEditedText(flowId, currentRunId)
        if (savedData?.savedAt) {
          console.log(
            '💾 localStorage savedAt:',
            new Date(savedData.savedAt).toLocaleString('nl-NL'),
            `(run: ${currentRunId})`,
          )
        }
      }
    }
    // NOTE: isLoadingFromBackend is intentionally NOT in the dependency array
    // It's only a guard condition to prevent saves during backend loads
    // If it were in the deps, the effect would re-run when it changes to false,
    // causing it to save the backend-loaded text to localStorage (overwriting user edits!)
  }, [flowId, markdown, isEdited, runs, selectedRun, latestRun])

  // Refs for measuring header height
  const headerRef = useRef<HTMLDivElement>(null)
  const [toolbarTop, setToolbarTop] = useState('calc(var(--ams-space-l) + 85px)')

  // Measure header height and update toolbar position
  useEffect(() => {
    const updateToolbarPosition = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight
        setToolbarTop(`${height}px`)
      }
    }

    updateToolbarPosition()
    window.addEventListener('resize', updateToolbarPosition)

    const resizeObserver = new ResizeObserver(updateToolbarPosition)
    if (headerRef.current) {
      resizeObserver.observe(headerRef.current)
    }

    return () => {
      window.removeEventListener('resize', updateToolbarPosition)
      resizeObserver.disconnect()
    }
  }, [])

  // Checklist state
  const [checklist, setChecklist] = useState({
    completeness: false,
    accuracy: false,
    sources: false,
    formatting: false,
  })

  const [finalApproval, setFinalApproval] = useState(false)
  const allChecklistItemsChecked = Object.values(checklist).every(Boolean)

  const handleChecklistChange = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleMarkdownChange = (newMarkdown: string) => {
    setMarkdown(newMarkdown)
    // Don't mark as edited if we're currently resetting
    if (!isResettingRef.current) {
      setIsEdited(true)
    }
  }

  const handleRetry = async () => {
    if (!flowId) return

    setIsRetrying(true)
    try {
      await triggerRun(flowId)
      await mutateRuns() // Refresh runs data
    } catch (error) {
      console.error('Failed to retry run:', error)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleReset = async () => {
    if (!flowId || !latestRun?.id) return

    // Mark that we're resetting to prevent save effect from running
    isResettingRef.current = true

    // Clear localStorage for this run
    clearEditedText(flowId, latestRun.id)

    // Reset to the generated version (not edited)
    setSelectedRunId(`${latestRun.id}-generated`)

    // Reload text from latest run
    try {
      const res = await fetch(`/api/flows/${flowId}/runs/${latestRun.id}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch run: ${res.status}`)
      }

      const data = await res.json()
      const generatedText = data.generations?.[0]?.response || ''
      const generationId = data.generations?.[0]?.id || null

      setMarkdown(generatedText)
      setCurrentGenerationId(generationId)
      setCurrentRunId(latestRun.id)
      setIsEdited(false)
      setResetCounter((prev) => prev + 1) // Force remount of editor

      // Explicitly save to localStorage with edited=false to ensure consistency
      saveEditedText(flowId, latestRun.id, generatedText, false)

      // Clear the resetting flag after state updates have been processed
      setTimeout(() => {
        isResettingRef.current = false
      }, 100)
    } catch (error) {
      console.error('Failed to reset to generated text:', error)
      isResettingRef.current = false
    }
  }

  const handleVersionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const versionId = event.target.value // Format: "runId-generated" or "runId-edited"

    const parsed = parseSelectedVersion(versionId)
    console.log('📋 DROPDOWN VERSION CHANGE:', {
      newVersionId: versionId,
      parsedRunId: parsed.runId,
      isEditedVersion: parsed.isEditedVersion,
      previousSelectedRunId: selectedRunId,
    })

    // Mark that we're resetting to prevent save effect from running
    isResettingRef.current = true

    // DON'T clear localStorage when switching versions - preserve unsaved edits
    // localStorage will be shown if user switches back to the latest version
    // and the localStorage timestamp is newer than the database version

    // Update the selected version - useEffect will handle loading the text
    // and the markdown useEffect will call setMarkdown imperatively
    setSelectedRunId(versionId)

    // Clear the resetting flag after state updates have been processed
    setTimeout(() => {
      isResettingRef.current = false
    }, 100)
  }

  const handleSaveVersion = async () => {
    if (!currentGenerationId || !markdown || !currentRunId) {
      return
    }

    setIsSaving(true)
    try {
      const saveResult = await saveEditedGeneration(currentGenerationId, markdown)
      console.log('💾 Save result:', saveResult)

      // Clear the edited flag and localStorage since it's now saved to backend
      setIsEdited(false)
      if (flowId) {
        clearEditedText(flowId, currentRunId)
      }

      // Optimistically update the runs cache with the current timestamp
      const savedTimestamp = new Date().toISOString()
      await mutateRuns(
        (currentRuns) => {
          if (!currentRuns) return currentRuns
          return currentRuns.map((run) =>
            run.id === currentRunId
              ? {
                  ...run,
                  is_user_edited: true,
                  edited_response: markdown,
                  updated_at: savedTimestamp,
                }
              : run,
          )
        },
        { revalidate: false },
      )

      // Switch to viewing the edited version that was just saved
      setSelectedRunId(`${currentRunId}-edited`)

      // Revalidate after a delay to stay in sync with backend, preserving our timestamp
      setTimeout(async () => {
        await mutateRuns(
          async (currentRuns) => {
            if (!currentRuns) return currentRuns
            // Fetch fresh data from backend
            const res = await fetch(`/api/flows/${flowId}/runs`, { credentials: 'include' })
            const backendRuns = await res.json()
            console.log('🔍 Backend runs data:', JSON.stringify(backendRuns, null, 2))
            console.log('🔍 First run keys:', backendRuns[0] ? Object.keys(backendRuns[0]) : 'no runs')
            // Merge backend data with our saved timestamp
            return backendRuns.map((backendRun: any) =>
              backendRun.id === currentRunId && backendRun.is_user_edited
                ? { ...backendRun, updated_at: savedTimestamp }
                : backendRun,
            )
          },
          { revalidate: false },
        )
      }, 1000)
    } catch (error) {
      console.error('Failed to save generation:', error)
      // Optionally show an error toast/alert to the user
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscardChanges = () => {
    if (!flowId || !currentRunId) return

    // Close the dialog
    discardDialogRef.current?.close()

    // Mark that we're resetting to prevent save effect from running
    isResettingRef.current = true

    // Clear localStorage for this run
    if (flowId) {
      clearEditedText(flowId, currentRunId)
    }

    // Reload the current version (either generated or edited)
    const runToLoad = selectedRun || latestRun
    if (runToLoad?.id) {
      fetch(`/api/flows/${flowId}/runs/${runToLoad.id}`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data) => {
          const generatedText = data.generations?.[0]?.response || ''

          // Determine which text to restore based on what we're viewing
          let textToRestore = generatedText
          if (isViewingEditedVersion && runToLoad.edited_response) {
            textToRestore = runToLoad.edited_response
          }

          setMarkdown(textToRestore)
          setIsEdited(false)
          setResetCounter((prev) => prev + 1) // Force remount of editor

          // Clear the resetting flag after state updates
          setTimeout(() => {
            isResettingRef.current = false
          }, 100)
        })
        .catch((err) => {
          console.error('Failed to discard changes:', err)
          isResettingRef.current = false
        })
    }
  }

  const handleRevertToGenerated = async () => {
    if (!currentGenerationId || !currentRunId || !flowId) return

    // Close the dialog
    revertDialogRef.current?.close()

    setIsSaving(true)
    try {
      // Send empty string to clear the edited_response
      await saveEditedGeneration(currentGenerationId, '')

      // Clear localStorage for this run
      clearEditedText(flowId, currentRunId)

      // Update SWR cache to remove the edited version
      await mutateRuns(
        (currentRuns) => {
          if (!currentRuns) return currentRuns
          return currentRuns.map((run) =>
            run.id === currentRunId
              ? {
                  ...run,
                  is_user_edited: false,
                  edited_response: '',
                }
              : run,
          )
        },
        { revalidate: false },
      )

      // Switch to viewing the generated version
      setSelectedRunId(`${currentRunId}-generated`)
      setIsEdited(false)

      // Revalidate to sync with backend
      setTimeout(() => {
        mutateRuns()
      }, 500)
    } catch (error) {
      console.error('Failed to revert to generated version:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!flowId) return

    try {
      // Patch the flow with status 'done'
      const response = await fetch(`/api/flows/${flowId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'done' }),
      })

      if (!response.ok) {
        throw new Error('Failed to update flow status')
      }

      // Navigate to /project page with collectionId
      const params = new URLSearchParams()
      if (collectionId) {
        params.set('collectionId', collectionId)
      }
      router.push(`/project?${params.toString()}`)
    } catch (error) {
      console.error('Failed to approve chapter:', error)
      // Optionally show an error toast/alert to the user
    }
  }

  return (
    <Grid paddingTop="large" gapVertical="none">
      <Grid.Cell span="all">
        <div style={{ display: 'flex', justifyContent: 'center' }} className='ams-mb-l'>
          <ProjectSteps />
        </div>
      </Grid.Cell>
      {/* Left column - Main content */}
      <Grid.Cell span={{ narrow: 4, medium: 5, wide: 8 }} start={{ narrow: 1, medium: 1, wide: 1 }}>
        <div className={`inkoop-sticky-panel ${styles.mainPanel}`}>
          <section className="ams-mb-xl">
            <div ref={headerRef} className={styles.stickyHeader}>
              <Row gap="small" className="ams-mb-s">
                <Icon svg={DocumentWithPencilIcon}></Icon>
                <Paragraph size="large">
                  Concepttekst
                  {!isGenerating && !hasError && markdown && (
                    <span style={{ marginLeft: '0.5rem' }}>
                      <StatusBadge versionNumber={versionNumber} state={badgeState} />
                    </span>
                  )}
                </Paragraph>
              </Row>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Heading level={1}>
                  {collection && flow ? `${capitalize(collection.name)} - ${capitalize(flow.name)}` : 'Concept'}
                </Heading>
              </div>
            </div>

            {/* Loading State */}
            {isGenerating && (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <Paragraph size="large" style={{ marginBottom: '1rem' }}>
                  Concepttekst laden...
                </Paragraph>
                <Paragraph size="small">Dit kan enkele momenten duren.</Paragraph>
              </div>
            )}

            {/* Error State */}
            {!isGenerating && hasError && (
              <div style={{ padding: '2rem' }}>
                <Alert severity="error" heading="Fout bij genereren" headingLevel={3} style={{ marginBottom: '1rem' }}>
                  <Paragraph>
                    {latestRun?.error ||
                      runsError?.message ||
                      'Er is een fout opgetreden bij het genereren van de concepttekst.'}
                  </Paragraph>
                </Alert>
                <Button onClick={handleRetry} disabled={isRetrying}>
                  {isRetrying ? 'Opnieuw proberen...' : 'Opnieuw proberen'}
                </Button>
              </div>
            )}

            {/* Success State - Editor */}
            {!isGenerating && !hasError && hasLoadedContent && (
              <>
                {/* Alert for generated versions with edits or old versions */}
                {isReadOnly && !isViewingEditedVersion && (
                  <Alert
                    severity="warning"
                    heading="Alleen lezen"
                    headingLevel={4}
                    className="ams-mb-m"
                    style={{ marginTop: 'var(--ams-space-m)' }}
                  >
                    <Paragraph>
                      {currentRunHasEdit
                        ? 'Deze gegenereerde versie kan niet worden bewerkt omdat er een opgeslagen bewerking bestaat. Gebruik het versie-menu rechts om naar je bewerking te gaan, of klik hieronder om terug te gaan naar deze gegenereerde versie (dit verwijdert je opgeslagen bewerking).'
                        : 'Dit is een oudere versie. Je kunt alleen de nieuwste versie bewerken. Gebruik het versie-menu rechts om terug te gaan naar de nieuwste versie.'}
                    </Paragraph>
                  </Alert>
                )}

                {/* Action buttons - show when viewing generated version that has an edit */}
                {!isViewingEditedVersion && currentRunHasEdit && (
                  <div className="ams-mb-m">
                    <ActionGroup>
                      <Button
                        variant="primary"
                        icon={<EditIcon />}
                        iconBefore
                        onClick={() => setSelectedRunId(`${currentRunId}-edited`)}
                        disabled={isSaving}
                      >
                        Terug naar jouw bewerkte versie
                      </Button>
                      <Button
                        icon={<UndoIcon />}
                        iconBefore
                        variant="secondary"
                        onClick={() => revertDialogRef.current?.showModal()}
                        disabled={isSaving}
                      >
                        Reset naar gegenereerde versie
                      </Button>
                    </ActionGroup>
                  </div>
                )}

                <ConceptEditor
                  ref={editorRef}
                  key={`editor-${latestRun?.id}-${resetCounter}`}
                  markdown={markdown}
                  onChange={handleMarkdownChange}
                  toolbarTop={toolbarTop}
                  readOnly={isReadOnly}
                  placeholder="Begin met typen..."
                />
              </>
            )}

            {/* No runs yet - empty state */}
            {!isGenerating && !hasError && !hasLoadedContent && (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <Paragraph>
                  Geen concepttekst beschikbaar. Ga terug naar de bronnen pagina om een concepttekst te genereren.
                </Paragraph>
              </div>
            )}
          </section>
          <SourcesList documents={documents} websearchSources={websearchSources} />
        </div>
      </Grid.Cell>

      {/* Right column - Sidebar */}
      <Grid.Cell span={{ narrow: 4, medium: 3, wide: 4 }} start={{ narrow: 1, medium: 6, wide: 9 }}>
        <ApprovalSidebar
          checklist={checklist}
          onChecklistChange={handleChecklistChange}
          finalApproval={finalApproval}
          onFinalApprovalChange={setFinalApproval}
          allChecklistItemsChecked={allChecklistItemsChecked}
          runs={successfulRuns}
          selectedRunId={selectedRunId}
          latestRun={latestRun}
          isEdited={isEdited}
          isViewingLatest={isViewingLatest}
          onVersionChange={handleVersionChange}
          onReset={handleReset}
          onSave={handleSaveVersion}
          onDiscard={() => discardDialogRef.current?.showModal()}
          isSaving={isSaving}
          backendCheckboxes={checkboxes}
          onBackendCheckboxToggle={toggleCheckbox}
          onApprove={handleApprove}
        />
      </Grid.Cell>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        ref={discardDialogRef}
        heading="Wijzigingen verwijderen?"
        message="Weet je zeker dat je de niet-opgeslagen wijzigingen wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        cancelLabel="Annuleren"
        onConfirm={handleDiscardChanges}
        onCancel={() => discardDialogRef.current?.close()}
      />

      <ConfirmDialog
        ref={revertDialogRef}
        heading="Terug naar gegenereerde versie?"
        message="Hiermee wordt je opgeslagen bewerking permanent verwijderd en keer je terug naar de gegenereerde versie. Weet je het zeker?"
        confirmLabel="Terug naar gegenereerd"
        cancelLabel="Annuleren"
        onConfirm={handleRevertToGenerated}
        onCancel={() => revertDialogRef.current?.close()}
      />
    </Grid>
  )
}
