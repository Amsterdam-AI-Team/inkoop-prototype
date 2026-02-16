'use client'

import { useEffect, useRef, useState } from 'react'
import { TextInput, Icon } from '@amsterdam/design-system-react'
import { PencilIcon } from '@amsterdam/design-system-react-icons'
import styles from './EditableProjectTitle.module.css'

interface EditableProjectTitleProps {
  collectionType: string
  initialTitle?: string
  onTitleChange?: (title: string) => void
  placeholder?: string
}

export function EditableProjectTitle({
  collectionType,
  initialTitle = '',
  onTitleChange,
  placeholder = 'zonder titel',
}: EditableProjectTitleProps) {
  const [title, setTitle] = useState(initialTitle)
  const [isFocused, setIsFocused] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = evt.target.value
    setTitle(newTitle)

    // Debounced callback
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      const trimmedTitle = newTitle.trim()
      if (onTitleChange && trimmedTitle !== initialTitle) {
        onTitleChange(trimmedTitle)
      }
    }, 500) // 500ms debounce
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Blur on Enter
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }

    // Restore original on Escape
    if (e.key === 'Escape') {
      e.preventDefault()
      setTitle(initialTitle)
      e.currentTarget.blur()
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    setIsFocused(false)

    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }

    // Immediately save on blur if changed
    const trimmedTitle = title.trim()
    if (onTitleChange && trimmedTitle !== initialTitle) {
      onTitleChange(trimmedTitle)
    }
  }

  const handlePencilClick = () => {
    inputRef.current?.focus()
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const showPencil = !isFocused

  return (
    <div className={styles.wrapper}>
      <TextInput
        ref={inputRef}
        className="ams-mb-m"
        value={title}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
      />
      {showPencil && (
        <Icon
          svg={PencilIcon}
          className={styles.pencilIcon}
          onClick={handlePencilClick}
        />
      )}
    </div>
  )
}
