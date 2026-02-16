import { Heading, Paragraph, ActionGroup, Checkbox, Button, Select, Label, Badge } from '@amsterdam/design-system-react'
import { UndoIcon, SaveIcon, DocumentsIcon, PencilIcon, DocumentQuestionMarkIcon } from '@amsterdam/design-system-react-icons'
import NextLink from 'next/link'
import { useSearchParams } from 'next/navigation'
import styles from './ApprovalSidebar.module.css'

interface ChecklistState {
  completeness: boolean
  accuracy: boolean
  sources: boolean
  formatting: boolean
}

interface Run {
  id: string
  status: string
  created_at: string
  edited_at?: string
  error?: string
  is_user_edited?: boolean
  edited_response?: string
  updated_at?: string
}

interface BackendCheckbox {
  id: string
  flow_id: string
  name: string
  checked: boolean
  created_at: string
}

interface ApprovalSidebarProps {
  checklist: ChecklistState
  onChecklistChange: (key: keyof ChecklistState) => void
  finalApproval: boolean
  onFinalApprovalChange: (checked: boolean) => void
  allChecklistItemsChecked: boolean
  runs?: Run[]
  selectedRunId?: string | null
  latestRun?: Run | null
  isEdited?: boolean
  isViewingLatest?: boolean
  onVersionChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void
  onReset?: () => void
  onSave?: () => void
  onDiscard?: () => void
  isSaving?: boolean
  backendCheckboxes?: BackendCheckbox[]
  onBackendCheckboxToggle?: (checkboxId: string, checked: boolean) => void
  onApprove?: () => void
}

// Helper function to format time ago
const formatTimeAgo = (date: Date) => {
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) return 'zojuist'
  if (diffInMinutes < 60) return `${diffInMinutes} minuten geleden`
  if (diffInHours < 24) return `${diffInHours} uur geleden`
  if (diffInDays === 1) return 'gisteren'
  if (diffInDays < 7) return `${diffInDays} dagen geleden`

  // Format as date for older entries
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export const ApprovalSidebar = ({
  checklist,
  onChecklistChange,
  finalApproval,
  onFinalApprovalChange,
  allChecklistItemsChecked,
  runs,
  selectedRunId,
  latestRun,
  isEdited,
  isViewingLatest = true,
  onVersionChange,
  onReset,
  onSave,
  onDiscard,
  isSaving = false,
  backendCheckboxes = [],
  onBackendCheckboxToggle,
  onApprove,
}: ApprovalSidebarProps) => {
  const searchParams = useSearchParams()
  const flowId = searchParams.get('flowId')
  const collectionId = searchParams.get('collectionId')

  // Runs prop should already be filtered to only successful runs
  const successfulRuns = runs || []

  // Build version list: each run can have up to 2 entries (generated + edited)
  const versionOptions: Array<{
    value: string
    label: string
    isEdited: boolean
    run: Run
    timestamp: Date
    versionNumber: number
  }> = []

  successfulRuns.forEach((run, index) => {
    const versionNumber = successfulRuns.length - index
    const createdDate = new Date(run.created_at)
    const createdTimeAgo = formatTimeAgo(createdDate)

    // Add edited version first if it exists (will appear before generated)
    if (run.is_user_edited && run.edited_response) {
      const editedDate = new Date(run.edited_at || run.created_at)
      const editedTimeAgo = formatTimeAgo(editedDate)

      versionOptions.push({
        value: `${run.id}-edited`,
        label: `   Jouw bewerking gebaseerd op versie ${versionNumber} (${editedTimeAgo})`,
        isEdited: true,
        run: run,
        timestamp: editedDate,
        versionNumber: versionNumber,
      })
    }

    // Always add the generated version (will appear after edited if it exists)
    versionOptions.push({
      value: `${run.id}-generated`,
      label: `   Gegenereerde versie ${versionNumber} (${createdTimeAgo})`,
      isEdited: false,
      run: run,
      timestamp: createdDate,
      versionNumber: versionNumber,
    })
  })

  // Sort by version number (descending), edited versions first within each version
  // Since we already added edited before generated in the loop, they're already in the right order per version
  // The runs are already sorted newest first, so the order is correct

  // Find the newest version by timestamp
  const newestVersion = versionOptions.reduce((newest, current) =>
    current.timestamp > newest.timestamp ? current : newest
  , versionOptions[0])

  const hasMultipleVersions = versionOptions.length > 1
  const showVersionPanel = runs && runs.length > 0

  console.log('📋 DROPDOWN OPTIONS:', {
    versionCount: versionOptions.length,
    options: versionOptions.map(o => ({
      value: o.value,
      label: o.label,
      isEdited: o.isEdited,
      versionNumber: o.versionNumber,
    })),
    selectedRunId,
    newestVersionValue: newestVersion?.value,
    dropdownValue: selectedRunId ?? newestVersion?.value ?? '',
  })

  // Sort backend checkboxes: first by created_at (oldest first), then move checked items to bottom
  const sortedBackendCheckboxes = [...backendCheckboxes].sort((a, b) => {
    // First, separate checked and unchecked
    if (a.checked !== b.checked) {
      return a.checked ? 1 : -1 // Checked items go to bottom
    }
    // Within each group, sort by created_at (oldest first)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  // Calculate if all backend checkboxes are checked
  const allBackendCheckboxesChecked =
    sortedBackendCheckboxes.length > 0 && sortedBackendCheckboxes.every((cb) => cb.checked)

  return (
    <div className={`inkoop-sticky-panel ${styles.sidebar}`}>
      {/* Version & Changes section */}
      {showVersionPanel && (
        <section className={`${styles.checklistSection}`}>
          <Heading level={3} className="ams-mb-m">
            Versies
          </Heading>

          {/* Version Selector - only show if multiple versions */}
          {hasMultipleVersions && onVersionChange && (
            <div className="ams-mb-m">
              {/* <Label htmlFor="version-select">Selecteer versie</Label> */}
              <Select
                id="version-select"
                value={selectedRunId ?? newestVersion?.value ?? ''}
                onChange={onVersionChange}
                style={{ width: '100%' }}
              >
                {versionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Edit Status Badge */}
          {/* {isEdited && (
            <div className="ams-mb-m">
              <Badge label="Aangepast sinds generatie"></Badge>
            </div>
          )} */}

          <ActionGroup className={styles.actionGroupFullWidth}>
            {/* Save button - always show when there are edits */}
            {isEdited && (
              <Button
                icon={<SaveIcon />}
                iconBefore
                className={styles.flexButton}
                onClick={onSave}
                disabled={isSaving}
              >
                {isSaving ? 'Opslaan...' : 'Wijzigingen opslaan'}
              </Button>
            )}

            {/* Discard button - show when there are unsaved edits */}
            {isEdited && onDiscard && (
              <Button
                icon={<UndoIcon />}
                iconBefore
                variant="secondary"
                className={styles.flexButton}
                onClick={onDiscard}
                disabled={isSaving}
              >
                Wijzigingen verwijderen
              </Button>
            )}

            {/* Placeholder when no actions available */}
            {/* {!isEdited && (
              <Paragraph size="small" style={{ color: 'var(--ams-color-neutral-grey3)', fontStyle: 'italic' }}>
                Maak wijzigingen om op te slaan
              </Paragraph>
            )} */}
          </ActionGroup>
        </section>
      )}

      {/* Checklist section */}
      <section className={`ams-mb-xl ${styles.checklistSection}`}>
        <Heading level={3} className="ams-mb-m">
          Controleer zelf op volledigheid
        </Heading>
        <Paragraph className="ams-mb-m">
          Controleer of de tekst klopt en feitelijk juist is. Ga na of de volgende punten duidelijk en volledig zijn
          toegelicht en vink ze af:
        </Paragraph>

        {/* Backend checkboxes */}
        {sortedBackendCheckboxes.length > 0 && (
          <div className={styles.checkboxGroup}>
            {sortedBackendCheckboxes.map((checkbox) => (
              <div key={checkbox.id} className={styles.checkboxItem}>
                <Checkbox
                  checked={checkbox.checked}
                  onChange={(e) => onBackendCheckboxToggle?.(checkbox.id, e.target.checked)}
                >
                  {checkbox.name}
                </Checkbox>
              </div>
            ))}
          </div>
        )}

        {/* Local checklist (fallback if no backend checkboxes) */}
        {/* {sortedBackendCheckboxes.length === 0 && (
          <div className={styles.checkboxGroup}>
            <Checkbox checked={checklist.completeness} onChange={() => onChecklistChange('completeness')}>
              Volledigheid van de inhoud
            </Checkbox>
            <Checkbox checked={checklist.accuracy} onChange={() => onChecklistChange('accuracy')}>
              Feitelijke juistheid
            </Checkbox>
            <Checkbox checked={checklist.sources} onChange={() => onChecklistChange('sources')}>
              Bronvermelding correct
            </Checkbox>
            <Checkbox checked={checklist.formatting} onChange={() => onChecklistChange('formatting')}>
              Opmaak en leesbaarheid
            </Checkbox>
          </div>
        )} */}
      </section>

      {/* Secondary buttons section */}
      {/* <section className="ams-mb-2xl">
        <Heading level={3} className="ams-mb-m">
          Nog niet wat je zoekt?
        </Heading>
        <Paragraph className='ams-mb-m'>Je kan de instructies aanpassen en/of andere bronnen toevoegen en de tekst opnieuw genereren.</Paragraph>
        <ActionGroup>
          <NextLink href={`/project/instructie?flowId=${flowId}&collectionId=${collectionId}`}>
            <Button variant="secondary" icon={<DocumentQuestionMarkIcon />} iconBefore>
              Instructie aanpassen
            </Button>
          </NextLink>
          <NextLink href={`/project/bronnen?flowId=${flowId}&collectionId=${collectionId}`}>
            <Button variant="secondary" icon={<DocumentsIcon />} iconBefore>
              Bronnen toevoegen
            </Button>
          </NextLink>
        </ActionGroup>
      </section> */}

      {/* Bottom section with final approval - pushed to bottom */}
      <section className={styles.bottomSection}>
        <Checkbox
          checked={finalApproval}
          onChange={(e) => onFinalApprovalChange(e.target.checked)}
          disabled={!allBackendCheckboxesChecked}
        >
          Ik heb de tekst gecontroleerd op volledigheid en correctheid
        </Checkbox>
        <Button
          variant="primary"
          className={styles.approvalButton}
          disabled={!finalApproval || !allBackendCheckboxesChecked}
          onClick={onApprove}
        >
          Hoofdstuk goedkeuren
        </Button>
      </section>
    </div>
  )
}
