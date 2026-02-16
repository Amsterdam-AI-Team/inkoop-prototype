'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Column,
  Field,
  Grid,
  Heading,
  Label,
  Paragraph,
  TextInput,
  ErrorMessage,
} from '@amsterdam/design-system-react'
import { useAuth } from '@/contexts/AuthContext'
import styles from './page.module.css'

export default function LoginPage() {
  const router = useRouter()
  const { user, isLoading, refreshUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect to home if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Manual validation
    if (!email || !password) {
      setError('Vul beide velden in')
      setIsSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/login', {
        body: JSON.stringify({ email, password }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!res.ok) {
        // Je backend geeft bij verkeerde login waarschijnlijk 401 of 400
        const body = await res.json().catch(() => ({}))
        const msg = (body && (body.detail || body.message)) || 'Inloggen mislukt. Controleer je gegevens.'
        throw new Error(msg)
      }

      // We verwachten geen token meer in de response body,
      // omdat deze nu veilig in een HttpOnly cookie zit.
      await res.json()

      // Refresh the user in AuthContext
      await refreshUser()

      // Navigate to home page
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Er ging iets mis bij het inloggen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="ams-theme ams-theme--compact">
        <Grid paddingVertical="x-large" className={styles.loginGrid}>
          <Grid.Cell span={{ narrow: 4, medium: 4, wide: 4 }} start={{ narrow: 1, medium: 3, wide: 5 }}>
            <div className={`inkoop-white-background ${styles.loginCard}`}>
              <Paragraph>Laden…</Paragraph>
            </div>
          </Grid.Cell>
        </Grid>
      </div>
    )
  }

  // Don't show login form if already logged in (will redirect)
  if (user) {
    return null
  }

  return (
    <div className="ams-theme ams-theme--compact">
      <Grid paddingVertical="x-large" className={styles.loginGrid}>
        <Grid.Cell span={{ narrow: 4, medium: 6, wide: 8 }} start={{ narrow: 1, medium: 2, wide: 3 }}>
          <div className={`inkoop-white-background ${styles.loginCard}`}>
            <Column gap="large">
              <Heading level={2}>Inloggen</Heading>

              <form onSubmit={handleSubmit}>
                <Column gap="large">
                  {error && (
                    <ErrorMessage id="login-error">{error}</ErrorMessage>
                  )}

                  <Field>
                    <Label htmlFor="email">E-mail</Label>
                    <TextInput
                      autoComplete="email"
                      id="email"
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSubmit(e as any)
                        }
                      }}
                      type="email"
                      value={email}
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="password">Wachtwoord</Label>
                    <input
                      autoComplete="current-password"
                      id="password"
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSubmit(e as any)
                        }
                      }}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      className="ams-text-input"
                      aria-describedby={error ? 'login-error' : undefined}
                    />
                  </Field>

                  <Checkbox
                    checked={showPassword}
                    id="show-password"
                    onChange={(e) => setShowPassword(e.target.checked)}
                  >
                    Toon wachtwoord
                  </Checkbox>

                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? 'Bezig met inloggen…' : 'Inloggen'}
                  </Button>
                </Column>
              </form>
            </Column>
          </div>
        </Grid.Cell>
      </Grid>
    </div>
  )
}
