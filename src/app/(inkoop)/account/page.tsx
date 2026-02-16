'use client'

import { useState } from 'react'
import {
  Alert,
  Button,
  Field,
  Grid,
  Heading,
  Label,
  Paragraph,
  PasswordInput,
  TextInput,
} from '@amsterdam/design-system-react'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'
import { useAuth } from '@/contexts/AuthContext'

export default function AccountPage() {
  const { user } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleChangePassword() {
    setSuccessMessage(null)
    setErrorMessage(null)

    if (!currentPassword || !newPassword) {
      setErrorMessage('Vul alle velden in.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Nieuwe wachtwoorden komen niet overeen.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Wachtwoord wijzigen mislukt')
      }
      setSuccessMessage('Wachtwoord is gewijzigd.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <Grid paddingVertical="large">
      <CenteredInkoopPage>
        <div className="inkoop-white-background">
          <Heading level={1} className="ams-mb-s">
            Account
          </Heading>

          <Paragraph className="ams-mb-s">
            Ingelogd als {user.email}
          </Paragraph>

          {successMessage && (
            <Alert heading="Gelukt" headingLevel={2} severity="success" style={{ marginBottom: '1rem' }}>
              <Paragraph>{successMessage}</Paragraph>
            </Alert>
          )}

          {errorMessage && (
            <Alert heading="Fout" headingLevel={2} severity="error" style={{ marginBottom: '1rem' }}>
              <Paragraph>{errorMessage}</Paragraph>
            </Alert>
          )}

          <Heading level={2} className="ams-mb-s">
            Wachtwoord wijzigen
          </Heading>

          <Field style={{ marginBottom: '0.5rem' }}>
            <Label htmlFor="current-password">Huidig wachtwoord</Label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>

          <Field style={{ marginBottom: '0.5rem' }}>
            <Label htmlFor="new-password">Nieuw wachtwoord</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>

          <Field style={{ marginBottom: '1rem' }}>
            <Label htmlFor="confirm-password">Bevestig nieuw wachtwoord</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>

          <Button variant="primary" onClick={handleChangePassword} disabled={saving}>
            {saving ? 'Bezig…' : 'Wachtwoord wijzigen'}
          </Button>
        </div>
      </CenteredInkoopPage>
    </Grid>
  )
}
