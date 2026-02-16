import { z } from 'zod'

/**
 * Normalizes a URL by adding protocol if missing
 * Examples:
 * - "google.com" -> "https://google.com"
 * - "www.google.com" -> "https://www.google.com"
 * - "https://google.com" -> "https://google.com"
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()

  // If it already has a protocol, return as-is
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  // Add https:// prefix
  return `https://${trimmed}`
}

/**
 * URL validation schema
 * - Validates URL format
 * - Ensures http/https protocol only
 * - Requires a valid domain with TLD (rejects single-word domains like "https://foo")
 * - Max length 2048 characters (browser standard)
 */
export const urlSchema = z
  .string()
  .min(1, 'URL mag niet leeg zijn')
  .max(2048, 'URL mag niet langer zijn dan 2048 tekens')
  .refine(
    (value) => {
      try {
        const url = new URL(value)

        // Check protocol
        if (!['http:', 'https:'].includes(url.protocol)) {
          return false
        }

        // Check hostname has at least one dot (e.g., reject "https://foo")
        // This ensures there's a TLD (top-level domain)
        if (!url.hostname.includes('.')) {
          return false
        }

        // Check hostname is not just dots
        if (url.hostname.replace(/\./g, '').length === 0) {
          return false
        }

        // Reject localhost and IP addresses if needed
        // (uncomment if you want to be more strict)
        // if (url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
        //   return false
        // }

        return true
      } catch {
        return false
      }
    },
    {
      message: 'Vul een geldige URL in met een domeinnaam (bijv. voorbeeld.nl)',
    }
  )

/**
 * File validation schema
 * - Validates file size (max 20MB per file)
 * - Validates file types (.docx, .xlsx, .pdf, .txt)
 * - Validates file count (max 10 files total)
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB in bytes
export const MAX_FILE_COUNT = 10
export const MAX_URL_COUNT = 20
const ALLOWED_FILE_TYPES = ['.docx', '.xlsx', '.pdf', '.txt']

export const fileSchema = z
  .custom<FileList>()
  .refine(
    (files) => files && files.length > 0,
    'Selecteer minimaal één bestand'
  )
  .refine(
    (files) => files && files.length <= MAX_FILE_COUNT,
    `Maximaal ${MAX_FILE_COUNT} bestanden toegestaan`
  )
  .refine(
    (files) =>
      files && Array.from(files).every((file) => file.size <= MAX_FILE_SIZE),
    'Elk bestand moet kleiner zijn dan 20MB'
  )
  .refine(
    (files) =>
      files &&
      Array.from(files).every((file) =>
        ALLOWED_FILE_TYPES.some((ext) => file.name.toLowerCase().endsWith(ext))
      ),
    `Alleen ${ALLOWED_FILE_TYPES.join(', ')} bestanden zijn toegestaan`
  )

/**
 * Search input validation schema
 * - Min length 2 characters
 * - Max length 500 characters
 */
export const searchInputSchema = z
  .string()
  .min(2, 'Zoekterm moet minimaal 2 tekens bevatten')
  .max(500, 'Zoekterm mag niet langer zijn dan 500 tekens')
  .trim()

/**
 * Bronnen form schema
 * Validates the entire bronnen form including website links and files
 */
export const bronnenFormSchema = z.object({
  websiteLink: urlSchema.optional(),
  files: fileSchema.optional(),
})

/**
 * Collection schema for creating/editing collections
 */
export const collectionSchema = z.object({
  name: z
    .string()
    .min(1, 'Naam is verplicht')
    .max(200, 'Naam mag niet langer zijn dan 200 tekens')
    .trim(),
  description: z
    .string()
    .max(1000, 'Beschrijving mag niet langer zijn dan 1000 tekens')
    .optional(),
})

/**
 * Utility function to validate a single URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return ['http:', 'https:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
}

/**
 * Utility function to validate file size
 */
export function isValidFileSize(file: File, maxSizeMB: number = 20): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxBytes
}

/**
 * Utility function to validate file type
 */
export function isValidFileType(
  file: File,
  allowedExtensions: string[] = ALLOWED_FILE_TYPES
): boolean {
  return allowedExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  )
}

/**
 * Utility function to format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
