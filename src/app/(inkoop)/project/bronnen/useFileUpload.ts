import { useState } from 'react'
import { isValidFileSize, isValidFileType, formatFileSize, MAX_FILE_COUNT } from '@/lib/validation/schemas'
import { useFlowMutations } from '@/hooks/useFlowMutations'
import type { KeyedMutator } from 'swr'

interface Document {
  id: string
  title: string
  mime_type: string
  original_size_bytes: number
}

export function useFileUpload(
  flowId: string | null,
  documents: Document[] | undefined,
  mutateDocuments: KeyedMutator<Document[]>
) {
  const [files, setFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const [fileError, setFileError] = useState<string | null>(null)
  const { markFlowInProgress } = useFlowMutations(flowId)

  const uploadFile = async (file: File) => {
    if (!flowId) {
      setFileError('Flow ID is ontbreekt. Kan bestand niet uploaden.')
      return
    }

    setUploadingFiles((prev) => new Set(prev).add(file.name))

    try {
      // Check for OneDrive/cloud placeholder files
      if (file.size === 0) {
        throw new Error(
          'Dit bestand lijkt een OneDrive/cloud placeholder te zijn. Download het bestand eerst naar je computer.'
        )
      }

      // Verify file is readable by attempting to read first few bytes
      try {
        const slice = file.slice(0, 100)
        await slice.arrayBuffer()
      } catch (readError) {
        throw new Error(
          'Kan bestand niet lezen. Als dit een OneDrive bestand is, zorg dat het gedownload is naar je computer.'
        )
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/flows/${flowId}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`)
      }

      await mutateDocuments()
      await markFlowInProgress()
      setFiles((prevFiles) => prevFiles.filter((f) => f.name !== file.name))
    } catch (error: any) {
      setFileError(`Fout bij uploaden van ${file.name}: ${error.message}`)
      setFiles((prevFiles) => prevFiles.filter((f) => f.name !== file.name))
    } finally {
      setUploadingFiles((prev) => {
        const next = new Set(prev)
        next.delete(file.name)
        return next
      })
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setFileError(null)

    const fileArray = Array.from(selectedFiles)
    const errors: string[] = []

    const totalFiles = (documents?.length || 0) + files.length + fileArray.length

    if (totalFiles > MAX_FILE_COUNT) {
      setFileError(`Maximaal ${MAX_FILE_COUNT} bestanden toegestaan. Je hebt al ${(documents?.length || 0) + files.length} bestand(en).`)
      event.target.value = ''
      return
    }

    for (const file of fileArray) {
      if (!isValidFileSize(file, 20)) {
        errors.push(`${file.name}: Bestand moet kleiner zijn dan 20MB (huidige grootte: ${formatFileSize(file.size)})`)
      }
      if (!isValidFileType(file)) {
        errors.push(`${file.name}: Alleen .docx, .xlsx, .pdf en .txt bestanden zijn toegestaan`)
      }
    }

    if (errors.length > 0) {
      setFileError(errors.join('\n'))
      event.target.value = ''
      return
    }

    const allExistingNames = [
      ...(documents?.map((doc) => doc.title) || []),
      ...files.map((file) => file.name),
    ]
    const duplicates = fileArray.filter((file) => allExistingNames.includes(file.name))
    if (duplicates.length > 0) {
      setFileError(`De volgende bestand(en) zijn al toegevoegd: ${duplicates.map((f) => f.name).join(', ')}`)
      event.target.value = ''
      return
    }

    setFiles((prevFiles) => [...prevFiles, ...fileArray])
    event.target.value = ''

    for (const file of fileArray) {
      await uploadFile(file)
    }
  }

  const handleDeleteFile = (fileToDelete: File) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file !== fileToDelete))
  }

  const handleDeleteUploadedDocument = async (documentId: string, documentTitle: string) => {
    if (!flowId) return

    try {
      // Optimistically remove the document from the UI
      await mutateDocuments(
        async (currentDocuments: Document[] | undefined) => {
          // Make the actual DELETE API call
          const response = await fetch(`/api/flows/${flowId}/documents/${documentId}`, {
            method: 'DELETE',
            credentials: 'include',
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Delete failed' }))
            throw new Error(errorData.detail || `Delete failed: ${response.statusText}`)
          }

          // Return the updated list after successful deletion
          return currentDocuments?.filter((doc) => doc.id !== documentId)
        },
        {
          // Optimistically show the document removed immediately
          optimisticData: documents?.filter((doc) => doc.id !== documentId),
          // Automatically rollback if the request fails
          rollbackOnError: true,
          // No need to revalidate since we're returning the correct data
          revalidate: false,
        }
      )
    } catch (error: any) {
      setFileError(`Fout bij verwijderen van ${documentTitle}: ${error.message}`)
    }
  }

  return {
    files,
    uploadingFiles,
    fileError,
    setFileError,
    handleFileChange,
    handleDeleteFile,
    handleDeleteUploadedDocument,
  }
}
