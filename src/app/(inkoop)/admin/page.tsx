'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Grid,
  Heading,
  Icon,
  Label,
  Paragraph,
  PasswordInput,
  TextInput,
} from '@amsterdam/design-system-react'
import { ChevronDownIcon, ChevronUpIcon } from '@amsterdam/design-system-react-icons'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingValue = {
  value: string
  updated_at?: string
}

type Settings = Record<string, SettingValue>

type FlowTemplate = {
  id: string
  name: string
  description: string
  template_name: string
  template_content: string
}

type AdminUser = {
  id: string
  email: string
  display_name: string | null
  is_admin: boolean
  has_password: boolean
  created_at: string | null
}

type CollectionTemplate = {
  id: string
  display_name: string
  type: string
  description: string
  template_content: string | null
  enabled: boolean
  flows: FlowTemplate[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  paddingTop: '1rem',
  paddingBottom: '1rem',
}

const previewBoxStyle: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  padding: '0.5rem',
  fontFamily: 'var(--ams-typography-font-family)',
}

const longPreviewBoxStyle: React.CSSProperties = {
  ...previewBoxStyle,
  maxHeight: 200,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  fontFamily: 'monospace',
  fontSize: '0.9rem',
  padding: '1rem',
}

const templatePreviewBoxStyle: React.CSSProperties = {
  ...longPreviewBoxStyle,
  fontFamily: 'var(--ams-typography-font-family)',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'monospace',
  fontSize: '0.9rem',
  padding: '1rem',
  border: '1px solid #ccc',
  borderRadius: '0px',
  boxSizing: 'border-box',
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleString('nl-NL')
  } catch {
    return dateStr
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const seedDialogRef = useRef<HTMLDialogElement>(null)

  // Global messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Settings state
  const [settings, setSettings] = useState<Settings>({})
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [editingSetting, setEditingSetting] = useState<string | null>(null)
  const [editingSettingValue, setEditingSettingValue] = useState('')

  // Collection templates state
  const [collectionTemplates, setCollectionTemplates] = useState<CollectionTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [collapsedTemplateIds, setCollapsedTemplateIds] = useState<Set<string>>(new Set())

  // Editing collection template
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingTemplateForm, setEditingTemplateForm] = useState({
    display_name: '',
    description: '',
    type: '',
    template_content: '',
    enabled: true,
  })

  // New collection template form
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [newTemplateForm, setNewTemplateForm] = useState({
    display_name: '',
    description: '',
    type: '',
    template_content: '',
    enabled: true,
  })

  // Editing flow template
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null)
  const [editingFlowForm, setEditingFlowForm] = useState({
    name: '',
    description: '',
    template_name: '',
    template_content: '',
  })

  // New flow template form
  const [newFlowForTemplateId, setNewFlowForTemplateId] = useState<string | null>(null)
  const [newFlowForm, setNewFlowForm] = useState({
    name: '',
    description: '',
    template_name: '',
    template_content: '',
  })

  // Delete confirmation
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null)
  const [confirmDeleteFlowId, setConfirmDeleteFlowId] = useState<string | null>(null)

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    display_name: '',
    password: '',
    is_admin: false,
  })
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null)
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [usersExpanded, setUsersExpanded] = useState(false)

  // -------------------------------------------------------------------------
  // Auth guard
  // -------------------------------------------------------------------------

  const isAdmin = !!(user as any)?.is_admin

  useEffect(() => {
    if (!isAuthLoading && !isAdmin) {
      router.push('/')
    }
  }, [isAuthLoading, isAdmin, router])

  // -------------------------------------------------------------------------
  // Message helpers
  // -------------------------------------------------------------------------

  function showSuccess(msg: string) {
    setSuccessMessage(msg)
    setErrorMessage(null)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  function showError(msg: string) {
    setErrorMessage(msg)
    setSuccessMessage(null)
  }

  // -------------------------------------------------------------------------
  // Fetch data
  // -------------------------------------------------------------------------

  async function fetchSettings() {
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/admin/settings')
      if (!res.ok) throw new Error('Kon instellingen niet ophalen')
      const data = await res.json()
      setSettings(data.settings ?? {})
    } catch (err: any) {
      showError(err.message)
    } finally {
      setSettingsLoading(false)
    }
  }

  async function fetchCollectionTemplates() {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/admin/collection-templates')
      if (!res.ok) throw new Error('Kon collectie templates niet ophalen')
      const data = await res.json()
      setCollectionTemplates(Array.isArray(data) ? data : [])
    } catch (err: any) {
      showError(err.message)
    } finally {
      setTemplatesLoading(false)
    }
  }

  async function fetchUsers() {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Kon gebruikers niet ophalen')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err: any) {
      showError(err.message)
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchSettings()
      fetchCollectionTemplates()
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // -------------------------------------------------------------------------
  // Settings CRUD
  // -------------------------------------------------------------------------

  function startEditSetting(key: string) {
    setEditingSetting(key)
    setEditingSettingValue(settings[key]?.value ?? '')
  }

  function cancelEditSetting() {
    setEditingSetting(null)
    setEditingSettingValue('')
  }

  async function saveSetting(key: string) {
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editingSettingValue }),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      setSettings((prev) => ({
        ...prev,
        [key]: { value: editingSettingValue, updated_at: new Date().toISOString() },
      }))
      setEditingSetting(null)
      showSuccess(`Instelling "${key}" opgeslagen.`)
    } catch (err: any) {
      showError(err.message)
    }
  }

  async function seedDefaults() {
    try {
      const res = await fetch('/api/admin/seed', { method: 'POST' })
      if (!res.ok) throw new Error('Standaardwaarden laden mislukt')
      showSuccess('Standaardwaarden geladen. Data wordt opnieuw opgehaald…')
      await fetchSettings()
      await fetchCollectionTemplates()
    } catch (err: any) {
      showError(err.message)
    }
  }

  // -------------------------------------------------------------------------
  // User CRUD
  // -------------------------------------------------------------------------

  async function createUser() {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Aanmaken mislukt')
      }
      const created = await res.json()
      setUsers((prev) => [...prev, { ...created, has_password: true }])
      setShowNewUser(false)
      setNewUserForm({ email: '', display_name: '', password: '', is_admin: false })
      showSuccess('Gebruiker aangemaakt.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  async function toggleAdmin(userId: string, currentValue: boolean) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: !currentValue }),
      })
      if (!res.ok) throw new Error('Wijzigen mislukt')
      const updated = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)))
      showSuccess(`Admin-status gewijzigd. De gebruiker moet opnieuw inloggen.`)
    } catch (err: any) {
      showError(err.message)
    }
  }

  async function resetPassword(userId: string) {
    if (!resetPasswordValue) {
      showError('Voer een nieuw wachtwoord in.')
      return
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPasswordValue }),
      })
      if (!res.ok) throw new Error('Wachtwoord reset mislukt')
      setResetPasswordUserId(null)
      setResetPasswordValue('')
      showSuccess('Wachtwoord is gereset.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  async function deleteUser(userId: string) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Verwijderen mislukt')
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setConfirmDeleteUserId(null)
      showSuccess('Gebruiker verwijderd.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  // -------------------------------------------------------------------------
  // Collection template CRUD
  // -------------------------------------------------------------------------

  function startEditTemplate(t: CollectionTemplate) {
    setEditingTemplateId(t.id)
    setEditingTemplateForm({
      display_name: t.display_name,
      description: t.description,
      type: t.type,
      template_content: t.template_content ?? '',
      enabled: t.enabled,
    })
  }

  function cancelEditTemplate() {
    setEditingTemplateId(null)
  }

  async function saveTemplate(id: string) {
    try {
      const res = await fetch(`/api/admin/collection-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplateForm),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      const updated = await res.json()
      setCollectionTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)))
      setEditingTemplateId(null)
      showSuccess('Collectie template opgeslagen.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  async function deleteTemplate(id: string) {
    try {
      const res = await fetch(`/api/admin/collection-templates/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Verwijderen mislukt')
      setCollectionTemplates((prev) => prev.filter((t) => t.id !== id))
      setConfirmDeleteTemplateId(null)
      setCollapsedTemplateIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      showSuccess('Collectie template verwijderd.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  async function createTemplate() {
    try {
      const res = await fetch('/api/admin/collection-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplateForm),
      })
      if (!res.ok) throw new Error('Aanmaken mislukt')
      const created = await res.json()
      setCollectionTemplates((prev) => [...prev, { ...created, flows: created.flows ?? [] }])
      setShowNewTemplate(false)
      setNewTemplateForm({ display_name: '', description: '', type: '', template_content: '', enabled: true })
      showSuccess('Nieuw document template aangemaakt.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  // -------------------------------------------------------------------------
  // Flow template CRUD
  // -------------------------------------------------------------------------

  function startEditFlow(f: FlowTemplate) {
    setEditingFlowId(f.id)
    setEditingFlowForm({
      name: f.name,
      description: f.description,
      template_name: f.template_name,
      template_content: f.template_content,
    })
  }

  function cancelEditFlow() {
    setEditingFlowId(null)
  }

  async function saveFlow(flowId: string) {
    try {
      const res = await fetch(`/api/admin/flow-templates/${flowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFlowForm),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      const updated = await res.json()
      setCollectionTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          flows: t.flows.map((f) => (f.id === flowId ? { ...f, ...updated } : f)),
        })),
      )
      setEditingFlowId(null)
      showSuccess('Flow template opgeslagen.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  async function deleteFlow(flowId: string) {
    try {
      const res = await fetch(`/api/admin/flow-templates/${flowId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Verwijderen mislukt')
      setCollectionTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          flows: t.flows.filter((f) => f.id !== flowId),
        })),
      )
      setConfirmDeleteFlowId(null)
      showSuccess('Flow template verwijderd.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  async function createFlow(collectionTemplateId: string) {
    try {
      const res = await fetch(`/api/admin/collection-templates/${collectionTemplateId}/flow-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFlowForm),
      })
      if (!res.ok) throw new Error('Aanmaken mislukt')
      const created = await res.json()
      setCollectionTemplates((prev) =>
        prev.map((t) => (t.id === collectionTemplateId ? { ...t, flows: [...t.flows, created] } : t)),
      )
      setNewFlowForTemplateId(null)
      setNewFlowForm({ name: '', description: '', template_name: '', template_content: '' })
      showSuccess('Nieuwe flow template aangemaakt.')
    } catch (err: any) {
      showError(err.message)
    }
  }

  // -------------------------------------------------------------------------
  // Render guards
  // -------------------------------------------------------------------------

  if (isAuthLoading) return null
  if (!isAdmin) return null

  // -------------------------------------------------------------------------
  // Setting card renderer
  // -------------------------------------------------------------------------

  const settingKeys = ['brand_name', 'system_prompt'] as const

  function renderSettingCard(key: string) {
    const setting = settings[key]
    const isEditing = editingSetting === key
    const isSystemPrompt = key === 'system_prompt'

    const labelMap: Record<string, string> = {
      brand_name: 'App naam (header, breadcrumb en teksten)',
      system_prompt: 'Hoofdinstructies (system prompt)',
    }

    return (
      <div key={key} className="ams-mb-m" style={cardStyle}>
        <Heading level={3} className="ams-mb-s">
          {labelMap[key] || key}
        </Heading>

        {!isEditing && (
          <>
            <div style={isSystemPrompt ? longPreviewBoxStyle : previewBoxStyle}>
              {setting?.value || <em>Geen waarde ingesteld</em>}
            </div>
            {setting?.updated_at && (
              <Paragraph style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#666' }}>
                Laatst bijgewerkt: {formatDate(setting.updated_at)}
              </Paragraph>
            )}
            <div style={{ marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => startEditSetting(key)}>
                Bewerken
              </Button>
            </div>
          </>
        )}

        {isEditing && (
          <>
            {isSystemPrompt ? (
              <textarea
                rows={15}
                style={textareaStyle}
                value={editingSettingValue}
                onChange={(e) => setEditingSettingValue(e.target.value)}
              />
            ) : (
              <Field>
                <Label htmlFor={`setting-${key}`}>Waarde</Label>
                <TextInput
                  id={`setting-${key}`}
                  value={editingSettingValue}
                  onChange={(e) => setEditingSettingValue(e.target.value)}
                />
              </Field>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="primary" onClick={() => saveSetting(key)}>
                Opslaan
              </Button>
              <Button variant="tertiary" onClick={cancelEditSetting}>
                Annuleren
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Flow template renderer
  // -------------------------------------------------------------------------

  function renderFlowTemplate(flow: FlowTemplate, collectionTemplateId: string) {
    const isEditing = editingFlowId === flow.id
    const isConfirmingDelete = confirmDeleteFlowId === flow.id

    return (
      <div key={flow.id} className="ams-mb-m" style={{ ...cardStyle, padding: '1rem', backgroundColor: '#e8e8e8', borderRadius: '4px' }}>
        {!isEditing && (
          <>
            <Heading level={4} className="ams-mb-xs">
              {flow.name}
            </Heading>
            <Paragraph className="ams-mb-s">{flow.description}</Paragraph>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => startEditFlow(flow)}>
                Bewerken
              </Button>
              {isConfirmingDelete ? (
                <>
                  <Button variant="primary" onClick={() => deleteFlow(flow.id)}>
                    Bevestig verwijderen
                  </Button>
                  <Button variant="tertiary" onClick={() => setConfirmDeleteFlowId(null)}>
                    Annuleren
                  </Button>
                </>
              ) : (
                <Button variant="tertiary" onClick={() => setConfirmDeleteFlowId(flow.id)}>
                  Verwijderen
                </Button>
              )}
            </div>
          </>
        )}

        {isEditing && (
          <>
            <Field className="ams-mb-l">
              <Label htmlFor={`flow-name-${flow.id}`}>Hoofdstuk naam</Label>
              <TextInput
                id={`flow-name-${flow.id}`}
                value={editingFlowForm.name}
                onChange={(e) => setEditingFlowForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field className="ams-mb-l">
              <Label htmlFor={`flow-desc-${flow.id}`}>Hoofdstuk beschrijving</Label>
              <TextInput
                id={`flow-desc-${flow.id}`}
                value={editingFlowForm.description}
                onChange={(e) => setEditingFlowForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <div className="ams-mb-l">
              <div className='ams-mb-s'><Label htmlFor={`flow-tcontent-${flow.id}`}>Hoofdstuk instructies</Label></div>
              <textarea
                id={`flow-tcontent-${flow.id}`}
                rows={20}
                style={textareaStyle}
                value={editingFlowForm.template_content}
                onChange={(e) => setEditingFlowForm((f) => ({ ...f, template_content: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="primary" onClick={() => saveFlow(flow.id)}>
                Opslaan
              </Button>
              <Button variant="tertiary" onClick={cancelEditFlow}>
                Annuleren
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Collection template renderer
  // -------------------------------------------------------------------------

  function renderCollectionTemplate(t: CollectionTemplate) {
    const isExpanded = !collapsedTemplateIds.has(t.id)
    const isEditing = editingTemplateId === t.id
    const isConfirmingDelete = confirmDeleteTemplateId === t.id

    return (
      <div key={t.id} className="ams-mb-m" style={{ ...cardStyle, backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
        {!isEditing && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Heading level={3} className="ams-mb-xs">
                  {t.display_name}
                </Heading>
                <Paragraph className="ams-mb-xs" style={{ fontSize: '0.85rem', color: '#666' }}>
                  {t.enabled ? 'Actief' : 'Inactief'}
                </Paragraph>
                <Paragraph>{t.description}</Paragraph>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <Button variant="secondary" onClick={() => startEditTemplate(t)}>
                  Bewerken
                </Button>
                {isConfirmingDelete ? (
                  <>
                    <Button variant="primary" onClick={() => deleteTemplate(t.id)}>
                      Bevestig verwijderen
                    </Button>
                    <Button variant="tertiary" onClick={() => setConfirmDeleteTemplateId(null)}>
                      Annuleren
                    </Button>
                  </>
                ) : (
                  <Button variant="tertiary" onClick={() => setConfirmDeleteTemplateId(t.id)}>
                    Verwijderen
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {isEditing && (
          <div style={{ marginTop: '0.5rem' }}>
            <Field className="ams-mb-l">
              <Label htmlFor={`ct-name-${t.id}`}>Weergavenaam</Label>
              <TextInput
                id={`ct-name-${t.id}`}
                value={editingTemplateForm.display_name}
                onChange={(e) => setEditingTemplateForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </Field>
            <Field className="ams-mb-l">
              <Label htmlFor={`ct-desc-${t.id}`}>Beschrijving</Label>
              <TextInput
                id={`ct-desc-${t.id}`}
                value={editingTemplateForm.description}
                onChange={(e) => setEditingTemplateForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <div className="ams-mb-s">
              <Label htmlFor={`ct-tcontent-${t.id}`}>Document prompt (optioneel)</Label>
              <Paragraph className="ams-mb-xs" style={{ fontSize: '0.85rem', color: '#666' }}>
                Wordt meegestuurd als extra context bij elke hoofdstuk-generatie binnen dit document.
              </Paragraph>
              <textarea
                id={`ct-tcontent-${t.id}`}
                rows={10}
                style={textareaStyle}
                value={editingTemplateForm.template_content}
                onChange={(e) => setEditingTemplateForm((f) => ({ ...f, template_content: e.target.value }))}
              />
            </div>
            {t.flows.length > 0 && (
              <div className="ams-mb-s">
                <Checkbox
                  checked={editingTemplateForm.enabled}
                  onChange={(e) => setEditingTemplateForm((f) => ({ ...f, enabled: e.target.checked }))}
                >
                  Actief
                </Checkbox>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="primary" onClick={() => saveTemplate(t.id)}>
                Opslaan
              </Button>
              <Button variant="tertiary" onClick={cancelEditTemplate}>
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {!isEditing && (
          <div style={{ marginTop: '1rem' }}>
            {t.template_content && (
              <div className="ams-mb-l">
                <Heading level={4} className="ams-mb-xs">
                  Instructies voor document '{t.display_name}' (optioneel)
                </Heading>
                <div style={{ ...templatePreviewBoxStyle, backgroundColor: '#fff', border: '1px solid #ccc' }}>{t.template_content}</div>
              </div>
            )}

            <div
              className="ams-mb-s"
              style={{
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onClick={() =>
                setCollapsedTemplateIds((prev) => {
                  const next = new Set(prev)
                  isExpanded ? next.add(t.id) : next.delete(t.id)
                  return next
                })
              }
            >
              <Heading level={4}>
              Hoofdstuk templates ({t.flows.length})
              </Heading>
              <Icon svg={isExpanded ? ChevronUpIcon : ChevronDownIcon} />
            </div>

            {isExpanded && (
              <>
                {/* {t.flows.length === 0 && <Paragraph>Nog geen hoofdstuk templates.</Paragraph>} */}

                {t.flows.map((f) => renderFlowTemplate(f, t.id))}

                {newFlowForTemplateId === t.id ? (
                  <div className="ams-mb-m" style={{ ...cardStyle, padding: '1rem', backgroundColor: '#e8e8e8', borderRadius: '4px' }}>
                    <Heading level={4} className="ams-mb-s">
                      Nieuw hoofdstuk template
                    </Heading>
                    <Field className="ams-mb-l">
                      <Label htmlFor={`new-flow-name-${t.id}`}>Naam</Label>
                      <TextInput
                        id={`new-flow-name-${t.id}`}
                        value={newFlowForm.name}
                        onChange={(e) => setNewFlowForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </Field>
                    <Field className="ams-mb-l">
                      <Label htmlFor={`new-flow-desc-${t.id}`}>Beschrijving</Label>
                      <TextInput
                        id={`new-flow-desc-${t.id}`}
                        value={newFlowForm.description}
                        onChange={(e) => setNewFlowForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </Field>
                    <div className="ams-mb-s">
                      <Label htmlFor={`new-flow-tcontent-${t.id}`}>Template inhoud</Label>
                      <textarea
                        id={`new-flow-tcontent-${t.id}`}
                        rows={20}
                        style={textareaStyle}
                        value={newFlowForm.template_content}
                        onChange={(e) => setNewFlowForm((f) => ({ ...f, template_content: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button variant="primary" onClick={() => createFlow(t.id)}>
                        Opslaan
                      </Button>
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setNewFlowForTemplateId(null)
                          setNewFlowForm({ name: '', description: '', template_name: '', template_content: '' })
                        }}
                      >
                        Annuleren
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setNewFlowForTemplateId(t.id)
                      setNewFlowForm({ name: '', description: '', template_name: '', template_content: '' })
                    }}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Nieuw hoofdstuk template
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <Grid paddingVertical="large">
      <CenteredInkoopPage>
        <div className="inkoop-white-background">
          <Heading level={1} className="ams-mb-s">
            Beheer
          </Heading>

          {successMessage && (
            <Alert heading="Gelukt" headingLevel={2} severity="success" className="ams-mb-m">
              <Paragraph>{successMessage}</Paragraph>
            </Alert>
          )}

          {errorMessage && (
            <Alert heading="Fout" headingLevel={2} severity="error" className="ams-mb-m">
              <Paragraph>{errorMessage}</Paragraph>
            </Alert>
          )}

          {/* ---- Section 0: Users ---- */}
          <section className="ams-mb-xl">
            <div
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setUsersExpanded((v) => !v)}
            >
              <Heading level={2} className="ams-mb-s">
                Gebruikers{!usersLoading && ` (${users.length})`}
              </Heading>
              <Icon svg={usersExpanded ? ChevronUpIcon : ChevronDownIcon} />
            </div>

            {usersExpanded && (
              <>
                {usersLoading && <Paragraph>Gebruikers worden geladen…</Paragraph>}

                {!usersLoading && users.length === 0 && <Paragraph>Geen gebruikers gevonden.</Paragraph>}

                {!usersLoading &&
                  users.map((u) => (
                    <div key={u.id} className="ams-mb-m" style={{ ...cardStyle, backgroundColor: '#f5f5f5', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <Heading level={3} className="ams-mb-xs">
                            {u.display_name || u.email}
                          </Heading>
                          <Paragraph className="ams-mb-xs" style={{ fontSize: '0.85rem', color: '#666' }}>
                            {u.email}
                          </Paragraph>
                          <Paragraph style={{ fontSize: '0.85rem', color: '#666' }}>
                            {u.is_admin ? 'Admin' : 'Gebruiker'}
                            {!u.has_password && ' · Geen wachtwoord'}
                            {u.created_at && ` · Aangemaakt: ${formatDate(u.created_at)}`}
                          </Paragraph>
                        </div>
                      </div>

                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={() => toggleAdmin(u.id, u.is_admin)}>
                          {u.is_admin ? 'Admin intrekken' : 'Admin maken'}
                        </Button>

                        {resetPasswordUserId === u.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                            <Field>
                              <Label htmlFor={`reset-pw-${u.id}`}>Nieuw wachtwoord</Label>
                              <PasswordInput
                                id={`reset-pw-${u.id}`}
                                value={resetPasswordValue}
                                onChange={(e) => setResetPasswordValue(e.target.value)}
                              />
                            </Field>
                            <Button variant="primary" onClick={() => resetPassword(u.id)}>
                              Opslaan
                            </Button>
                            <Button
                              variant="tertiary"
                              onClick={() => {
                                setResetPasswordUserId(null)
                                setResetPasswordValue('')
                              }}
                            >
                              Annuleren
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setResetPasswordUserId(u.id)
                              setResetPasswordValue('')
                            }}
                          >
                            Wachtwoord resetten
                          </Button>
                        )}

                        {confirmDeleteUserId === u.id ? (
                          <>
                            <Button variant="primary" onClick={() => deleteUser(u.id)}>
                              Bevestig verwijderen
                            </Button>
                            <Button variant="tertiary" onClick={() => setConfirmDeleteUserId(null)}>
                              Annuleren
                            </Button>
                          </>
                        ) : (
                          <Button variant="tertiary" onClick={() => setConfirmDeleteUserId(u.id)}>
                            Verwijderen
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                {showNewUser ? (
                  <div className="ams-mb-m" style={{ ...cardStyle, backgroundColor: '#f0f7ff' }}>
                    <Heading level={3} className="ams-mb-s">
                      Nieuwe gebruiker
                    </Heading>
                    <Field className="ams-mb-l">
                      <Label htmlFor="new-user-email">E-mailadres</Label>
                      <TextInput
                        id="new-user-email"
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </Field>
                    <Field className="ams-mb-l">
                      <Label htmlFor="new-user-name">Weergavenaam</Label>
                      <TextInput
                        id="new-user-name"
                        value={newUserForm.display_name}
                        onChange={(e) => setNewUserForm((f) => ({ ...f, display_name: e.target.value }))}
                      />
                    </Field>
                    <Field className="ams-mb-l">
                      <Label htmlFor="new-user-password">Wachtwoord</Label>
                      <PasswordInput
                        id="new-user-password"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
                      />
                    </Field>
                    <div className="ams-mb-s">
                      <Checkbox
                        checked={newUserForm.is_admin}
                        onChange={(e) => setNewUserForm((f) => ({ ...f, is_admin: e.target.checked }))}
                      >
                        Admin
                      </Checkbox>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button variant="primary" onClick={createUser}>
                        Aanmaken
                      </Button>
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setShowNewUser(false)
                          setNewUserForm({ email: '', display_name: '', password: '', is_admin: false })
                        }}
                      >
                        Annuleren
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setShowNewUser(true)} style={{ marginTop: '0.5rem' }}>
                    Nieuwe gebruiker
                  </Button>
                )}
              </>
            )}
          </section>

          {/* ---- Section 1: App Settings ---- */}
          <section className="ams-mb-xl">
            <Heading level={2} className="ams-mb-s">
              App-instellingen
            </Heading>

            {settingsLoading && <Paragraph>Instellingen worden geladen…</Paragraph>}

            {!settingsLoading && settingKeys.map((key) => renderSettingCard(key))}
          </section>

          {/* ---- Section 2: Collection Templates ---- */}
          <section>
            <Heading level={2} className="ams-mb-s">
              Documenten templates
            </Heading>

            {templatesLoading && <Paragraph>Templates worden geladen…</Paragraph>}

            {!templatesLoading && collectionTemplates.length === 0 && (
              <Paragraph>Geen documenten templates gevonden.</Paragraph>
            )}

            {!templatesLoading && collectionTemplates.map((t) => renderCollectionTemplate(t))}

            {showNewTemplate ? (
              <div className="ams-mb-m" style={{ ...cardStyle, backgroundColor: '#f0f7ff', padding: '1rem' }}>
                <Heading level={3} className="ams-mb-s">
                  Nieuw collectie template
                </Heading>
                <Field className="ams-mb-l">
                  <Label htmlFor="new-ct-name">Naam</Label>
                  <TextInput
                    id="new-ct-name"
                    value={newTemplateForm.display_name}
                    onChange={(e) => setNewTemplateForm((f) => ({ ...f, display_name: e.target.value }))}
                  />
                </Field>
                <Field className="ams-mb-l">
                  <Label htmlFor="new-ct-desc">Beschrijving</Label>
                  <TextInput
                    id="new-ct-desc"
                    value={newTemplateForm.description}
                    onChange={(e) => setNewTemplateForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </Field>
                <div className="ams-mb-s">
                  <Label htmlFor="new-ct-tcontent">Document prompt (optioneel)</Label>
                  <Paragraph className="ams-mb-xs" style={{ fontSize: '0.85rem', color: '#666' }}>
                    Wordt meegestuurd als extra context bij elke flow-generatie binnen deze collectie.
                  </Paragraph>
                  <textarea
                    id="new-ct-tcontent"
                    rows={10}
                    style={textareaStyle}
                    value={newTemplateForm.template_content}
                    onChange={(e) => setNewTemplateForm((f) => ({ ...f, template_content: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="primary" onClick={createTemplate}>
                    Opslaan
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      setShowNewTemplate(false)
                      setNewTemplateForm({
                        display_name: '',
                        description: '',
                        type: '',
                        template_content: '',
                        enabled: true,
                      })
                    }}
                  >
                    Annuleren
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setShowNewTemplate(true)} style={{ marginTop: '0.5rem' }}>
                Nieuw collectie template
              </Button>
            )}
          </section>

        </div>
          {/* ---- Danger zone ---- */}
          <section style={{ marginTop: '3rem' }}>
            <Button
              variant="primary"
              onClick={() => seedDialogRef.current?.showModal()}
              style={{ backgroundColor: '#ec0000', color: '#fff' }}
            >
              Reset naar standaardwaarden inkoop
            </Button>
          </section>

        <ConfirmDialog
          ref={seedDialogRef}
          heading="Naar inkoop standaardwaarden resetten?"
          message="Dit laadt de standaard inkoop instellingen en templates. Alle bestaande instellingen en templates worden overschreven."
          confirmLabel="Ja, laden"
          cancelLabel="Annuleren"
          onConfirm={() => {
            seedDialogRef.current?.close()
            seedDefaults()
          }}
          onCancel={() => seedDialogRef.current?.close()}
        />
      </CenteredInkoopPage>
    </Grid>
  )
}
