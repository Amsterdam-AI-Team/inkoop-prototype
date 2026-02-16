'use client'

import {
  Breadcrumb,
  Button,
  Column,
  DescriptionList,
  Grid,
  Heading,
  LinkList,
  Paragraph,
  Row,
} from '@amsterdam/design-system-react'
import { ConnectedCirclesIcon, DocumentsIcon } from '@amsterdam/design-system-react-icons'
import NextLink from 'next/link'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'

import { useAuth } from '@/contexts/AuthContext'
import formatPath from '@/utils/formatPath'
import { useCollections } from '@/hooks/useInkoopData'
import { useAppSettings } from '@/hooks/useAppSettings'

export default function HomePage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const { settings } = useAppSettings()

  // Use SWR hook for collections data
  const { collections, isLoading: isLoadingCollections, isError } = useCollections()

  const loading = isAuthLoading || isLoadingCollections
  const error = isError ? 'Er ging iets mis bij het ophalen van projecten.' : null

  // Don't render any content until authentication is verified
  if (isAuthLoading) {
    return null
  }

  return (
    <Grid paddingVertical="large">
      {/* Don't remove this for now, i want to play with this later */}
      {/* <Grid.Cell span="all">
        <Heading level={1} size="level-1">
          Dashboard
        </Heading>
        <Paragraph size="large">
          Welkom bij het Inkoop portaal van de gemeente Amsterdam
        </Paragraph>
      </Grid.Cell> */}
      {/* <Grid.Cell span={{ narrow: 4, medium: 2, wide: 2 }} start={1}>
        <div className="inkoop-white-background">
          <LinkList>
            <LinkList.Link href="#">Overzicht</LinkList.Link>
            <LinkList.Link href="#">Contracten</LinkList.Link>
            <LinkList.Link href="#">Leveranciers</LinkList.Link>
            <LinkList.Link href="#">Aanbestedingen</LinkList.Link>
            <LinkList.Link href="#">Rapportages</LinkList.Link>
          </LinkList>
        </div>
      </Grid.Cell> */}
      <CenteredInkoopPage>
        <div className="inkoop-white-background">
          <section className="ams-mb-xl">
            <Heading level={1} className="ams-mb-s">
              Welkom bij de {settings.brand_name.toLowerCase()}
            </Heading>
            <Paragraph size="large">
              De {settings.brand_name.toLowerCase()} helpt je bij het opstellen van documenten met AI. Voeg per project en
              hoofdstuk je eigen documenten, websites en instructies toe om een eerste opzet van de tekst te laten
              genereren. Pas deze tekst zelf aan om tot het gewenste resultaat te komen.
            </Paragraph>
          </section>
          <section className="ams-mb-xl">
            <Heading level={2} className="ams-mb-s">
              Mijn projecten
            </Heading>

            {loading && <Paragraph>Projecten worden geladen…</Paragraph>}

            {error && !loading && <Paragraph>Er ging iets mis: {error}</Paragraph>}

            {!loading && !error && (!collections || collections.length === 0) && (
              <Paragraph>Je hebt nog geen projecten.</Paragraph>
            )}

            {!loading && !error && collections && collections.length > 0 && (
              <LinkList>
                {collections.map((c) => (
                  <NextLink key={c.id} href={`/project?collectionId=${c.id}`} passHref legacyBehavior>
                    <LinkList.Link size="large" icon={ConnectedCirclesIcon}>
                      {c.name}
                    </LinkList.Link>
                  </NextLink>
                ))}
              </LinkList>
            )}
          </section>

          <NextLink href="/project/new">
            <Button>Maak nieuw project aan</Button>
          </NextLink>
        </div>
      </CenteredInkoopPage>
    </Grid>
  )
}
