/**
 * LocalStorage utility for managing edited concept text
 * Stores user edits per flow ID and run ID (version-specific)
 */

export interface EditedText {
  text: string
  edited: boolean
  savedAt: string
}

const STORAGE_PREFIX = 'concepttekst_edit_'

/**
 * Get edited text for a specific run/version from localStorage
 * @param flowId - The flow ID
 * @param runId - The run ID (optional for backward compatibility)
 */
export function getEditedText(flowId: string, runId?: string | null): EditedText | null {
  if (typeof window === 'undefined') return null

  try {
    // If runId is provided, use version-specific key
    const key = runId ? `${STORAGE_PREFIX}${flowId}_${runId}` : `${STORAGE_PREFIX}${flowId}`
    const stored = localStorage.getItem(key)

    if (!stored) return null

    return JSON.parse(stored) as EditedText
  } catch (error) {
    console.error('Failed to get edited text from localStorage:', error)
    return null
  }
}

/**
 * Save edited text for a specific run/version to localStorage
 * @param flowId - The flow ID
 * @param runId - The run ID (optional for backward compatibility)
 * @param text - The text content
 * @param edited - Whether the text has unsaved edits
 */
export function saveEditedText(
  flowId: string,
  runId: string | null | undefined,
  text: string,
  edited: boolean,
): void {
  if (typeof window === 'undefined') return

  try {
    // If runId is provided, use version-specific key
    const key = runId ? `${STORAGE_PREFIX}${flowId}_${runId}` : `${STORAGE_PREFIX}${flowId}`
    const data: EditedText = {
      text,
      edited,
      savedAt: new Date().toISOString(),
    }

    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save edited text to localStorage:', error)
  }
}

/**
 * Clear edited text for a specific run/version from localStorage
 * @param flowId - The flow ID
 * @param runId - The run ID (optional - if not provided, clears the legacy key)
 */
export function clearEditedText(flowId: string, runId?: string | null): void {
  if (typeof window === 'undefined') return

  try {
    // If runId is provided, use version-specific key
    const key = runId ? `${STORAGE_PREFIX}${flowId}_${runId}` : `${STORAGE_PREFIX}${flowId}`
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Failed to clear edited text from localStorage:', error)
  }
}
