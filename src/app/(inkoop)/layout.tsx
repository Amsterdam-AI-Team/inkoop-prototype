'use client'

import { Avatar, Page, SkipLink } from '@amsterdam/design-system-react'
import NextLink from 'next/link'
import { ReactNode } from 'react'

import { CustomPageHeader } from '@/components/CustomPageHeader/CustomPageHeader'
import { InkoopBreadcrumb } from '@/components/InkoopBreadcrumb/InkoopBreadcrumb'
import { PrototypeBanner } from '@/components/PrototypeBanner'
import { InkoopMenu } from '@/components/InkoopMenu/InkoopMenu'
import { ScrollToTop } from '@/components/ScrollToTop/ScrollToTop'
import { useAuth } from '@/contexts/AuthContext'
import { useAppSettings } from '@/hooks/useAppSettings'
import '@amsterdam/design-system-tokens/dist/compact.theme.css'

import './inkoop.css'

function getInitials(email: string) {
  if (!email) return ''
  const parts = email.split('@')[0].split('.')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return email[0].toUpperCase()
}

export default function InkoopPrototypeLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { settings } = useAppSettings()

  const initials = user?.email ? getInitials(user.email) : undefined
  const userTitle = user?.display_name || user?.email || 'Niet ingelogd'

  return (
    <div className="ams-theme ams-theme--compact">
      <ScrollToTop />
      <Page withMenu>
        <SkipLink className="ams-page__area--skip-link" href="#main">
          Direct naar inhoud
        </SkipLink>
        <CustomPageHeader
          className="ams-page__area--header"
          brandName={settings.brand_name}
          breadcrumb={<InkoopBreadcrumb />}
          hideLogo
          logoLinkComponent={(props) => <NextLink {...props} href="/" />}
          logoLinkTitle={`Naar de homepage van ${settings.brand_name}`}
          menuItems={
            user ? (
              <Avatar label={initials} title={userTitle} />
            ) : (
              <Avatar label="" title="Niet ingelogd" />
            )
          }
          noMenuButtonOnWideWindow
        >
          <InkoopMenu />
        </CustomPageHeader>
        <InkoopMenu className="ams-page__area--menu" inWideWindow />
        <main className="ams-page__area--body inkoop-main-background" id="main">
        <PrototypeBanner />
          {children}
        </main>
      </Page>
    </div>
  )
}
