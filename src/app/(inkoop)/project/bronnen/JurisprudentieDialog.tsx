import { Dialog, Paragraph, Field, Label, TextArea, Button } from '@amsterdam/design-system-react'
import { forwardRef } from 'react'

interface JurisprudentieDialogProps {
  onClose: () => void
}

export const JurisprudentieDialog = forwardRef<HTMLDialogElement, JurisprudentieDialogProps>(
  ({ onClose }, ref) => {
    return (
      <Dialog ref={ref} onClose={onClose} heading="Waar ben je naar op zoek?" closeButtonLabel="Sluiten">
        <section className="ams-mb-xl">
          <Paragraph className="ams-mb-l">Beschrijf hier de jurisprudentie waar je naar op zoek bent.</Paragraph>
          <Field className="ams-mb-m">
            <Label htmlFor="jurisprudentie-input">Zoeken naar jurisprudentie</Label>
            <TextArea id="jurisprudentie-input" placeholder="Voer zoekterm in..." />
          </Field>
          <Button onClick={onClose}>Toevoegen</Button>
        </section>
      </Dialog>
    )
  }
)

JurisprudentieDialog.displayName = 'JurisprudentieDialog'
