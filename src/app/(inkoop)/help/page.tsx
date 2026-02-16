'use client'

import { Grid, Heading, Paragraph, OrderedList } from '@amsterdam/design-system-react'
import { CenteredInkoopPage } from '@/components/CenteredInkoopPage/CenteredInkoopPage'
import { useAppSettings } from '@/hooks/useAppSettings'
import Image from 'next/image'

export default function HelpPage() {
  const { settings } = useAppSettings()

  return (
    <Grid paddingVertical="large">
      <CenteredInkoopPage>
        <div className="inkoop-white-background">
          <Heading level={1} className="ams-mb-s">
            Help
          </Heading>
          <Paragraph size="large" className="ams-mb-m">
            Welkom op de help pagina van de {settings.brand_name.toLowerCase()}.
          </Paragraph>
          <Heading level={2} className="ams-mb-s">
            Hoe werkt het?
          </Heading>
          <Paragraph className="ams-mb-m">
            Met deze tool kan je in een paar stappen hulp krijgen bij het opstellen van een document. De tool
            bevat per hoofdstuk een sjabloon waar een taalmodel mee aan de slag kan. Je kan hier zelf instructies en
            bronnen toevoegen.
          </Paragraph>
          <Paragraph className="ams-mb-m">
            Je doorloopt de volgende stappen:
          </Paragraph>
          <OrderedList className="ams-mb-xl">
            <OrderedList.Item>Je kiest een hoofdstuk waar je aan wil werken</OrderedList.Item>
            <OrderedList.Item>Je controleert de instructie voor het taalmodel van dat hoofdstuk, en voegt eventueel je eigen extra instructie toe</OrderedList.Item>
            <OrderedList.Item>Je voegt bronnen zoals documenten en websites toe, en voert eventueel een AI zoekopdracht uit om websites te vinden</OrderedList.Item>
            <OrderedList.Item>Je leest de gegenereerde tekst en past deze aan indien nodig. We helpen je hierbij met een checklist. Je kan ook met andere bronnen en instructies de tekst hergenereren</OrderedList.Item>
          </OrderedList>

          <Heading level={2} className="ams-mb-s">
            Proces schets
          </Heading>
          <div className="ams-mt-l">
            <Image
              src="/concept-design.svg"
              alt="Proces overzicht"
              width={800}
              height={600}
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          <Heading level={2} className="ams-mb-s">
            Dit is een prototype
          </Heading>
          <Paragraph className="ams-mb-m">
            Zoals jullie weten is dit een prototype. Niet alles werkt nog even soepel als in een eindproduct. We zijn heel erg geholpen met jullie eerlijke feedback, dus schroom niet om die aan ons door te geven.
          </Paragraph>
        </div>
      </CenteredInkoopPage>
    </Grid>
  )
}
