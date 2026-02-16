'use client'

import { useState, useEffect } from 'react'
import { Heading, TextInput, Button, Label } from '@amsterdam/design-system-react'
import {
  useCellValues,
  usePublisher,
  cancelLinkEdit$,
  linkDialogState$,
  updateLink$,
} from '@mdxeditor/editor'
import styles from './CustomLinkDialog.module.css'

export const CustomLinkDialog = () => {
  const [dialogState] = useCellValues(linkDialogState$)
  const updateLink = usePublisher(updateLink$)
  const cancelEdit = usePublisher(cancelLinkEdit$)

  const [url, setUrl] = useState('')

  // Update local state when dialog opens with new values
  useEffect(() => {
    if (dialogState.type === 'edit') {
      setUrl(dialogState.url || dialogState.initialUrl || '')
    }
  }, [dialogState])

  // Only show dialog when in edit mode
  if (dialogState.type !== 'edit') {
    return null
  }

  const handleSave = () => {
    updateLink({
      url: url || undefined,
      title: undefined,
      text: undefined, // Let MDXEditor use the selected text
    })
  }

  const handleCancel = () => {
    cancelEdit()
  }

  // Position dialog below the selected text
  const { rectangle } = dialogState

  return (
    <div
      className={styles.dialog}
      style={{
        top: `${rectangle.top + rectangle.height + 8}px`,
        left: `${rectangle.left}px`,
      }}
    >
      <Heading level={4} className={styles.heading}>
        Link toevoegen
      </Heading>
      <div className={styles.inputWrapper}>
        <Label htmlFor="link-url">URL</Label>
        <TextInput
          id="link-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://voorbeeld.nl"
        />
      </div>
      <div className={styles.buttonGroup}>
        <Button variant="secondary" onClick={handleCancel}>
          Annuleren
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Opslaan
        </Button>
      </div>
    </div>
  )
}
