import { useState } from 'react'
import useSWR from 'swr'

export interface Checkbox {
  id: string
  flow_id: string
  name: string
  checked: boolean
  created_at: string
}

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    const error = new Error('Failed to fetch checkboxes')
    throw error
  }

  return res.json()
}

/**
 * Hook to fetch and manage checkboxes for a flow
 */
export function useCheckboxes(flowId: string | null) {
  const [error, setError] = useState<string | null>(null)

  const { data, error: swrError, isLoading, mutate } = useSWR<Checkbox[]>(
    flowId ? `/api/flows/${flowId}/checkboxes/` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  /**
   * Toggle a checkbox with optimistic updates
   */
  const toggleCheckbox = async (checkboxId: string, checked: boolean) => {
    if (!flowId) {
      setError('Flow ID is missing')
      return false
    }

    try {
      // Optimistically update the local data immediately
      await mutate(
        async (currentData) => {
          // Make the actual API call
          const response = await fetch(
            `/api/flows/${flowId}/checkboxes/${checkboxId}/toggle/${checked}`,
            {
              method: 'POST',
              credentials: 'include',
            }
          )

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Update failed' }))
            throw new Error(errorData.detail || `Update failed: ${response.statusText}`)
          }

          // Return the updated data after successful mutation
          if (!currentData) return currentData

          return currentData.map((checkbox) =>
            checkbox.id === checkboxId ? { ...checkbox, checked } : checkbox
          )
        },
        {
          // Optimistically show the updated state immediately
          optimisticData: data
            ? data.map((checkbox) =>
                checkbox.id === checkboxId ? { ...checkbox, checked } : checkbox
              )
            : undefined,
          // Automatically rollback if the request fails
          rollbackOnError: true,
          // No need to revalidate since we're returning the correct updated data
          revalidate: false,
        }
      )

      setError(null)
      return true
    } catch (err: any) {
      setError(`Fout bij bijwerken van checkbox: ${err.message}`)
      return false
    }
  }

  return {
    checkboxes: data || [],
    isLoading,
    error: error || swrError,
    setError,
    toggleCheckbox,
    mutate,
  }
}
