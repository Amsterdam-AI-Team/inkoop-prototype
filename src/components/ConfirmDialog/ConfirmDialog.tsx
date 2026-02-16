import { Dialog, Paragraph, Button, ActionGroup } from '@amsterdam/design-system-react'
import { forwardRef } from 'react'

interface ConfirmDialogProps {
  heading: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = forwardRef<HTMLDialogElement, ConfirmDialogProps>(
  (
    { heading, message, confirmLabel = 'Bevestigen', cancelLabel = 'Annuleren', onConfirm, onCancel },
    ref
  ) => {
    return (
      <Dialog ref={ref} onClose={onCancel} heading={heading} closeButtonLabel="Sluiten">
        <section className="ams-mb-xl">
          <Paragraph className="ams-mb-l">{message}</Paragraph>
          <ActionGroup>
            <Button onClick={onConfirm} variant="primary">
              {confirmLabel}
            </Button>
            <Button onClick={onCancel} variant="secondary">
              {cancelLabel}
            </Button>
          </ActionGroup>
        </section>
      </Dialog>
    )
  }
)

ConfirmDialog.displayName = 'ConfirmDialog'
