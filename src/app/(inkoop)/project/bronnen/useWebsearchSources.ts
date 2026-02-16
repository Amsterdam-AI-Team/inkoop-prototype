import { useState } from 'react'
import useSWR from 'swr'

interface WebsearchSource {
  id: string
  source_id: string // Backend returns source_id (starts with 'm' or 's')
  flow_id: string
  url: string
  title: string
  summary: string | null
  include_in_result: boolean
}

interface WebsearchSourcesResponse {
  sources?: WebsearchSource[]
}

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'POST',
  })

  if (!res.ok) {
    const error = new Error('Failed to fetch websearch sources')
    throw error
  }

  return res.json()
}

/**
 * Hook to fetch and manage websearch sources for a flow
 */
export function useWebsearchSources(flowId: string | null) {
  const [error, setError] = useState<string | null>(null)

  const { data, error: swrError, isLoading, mutate } = useSWR<WebsearchSourcesResponse>(
    flowId ? `/api/flows/${flowId}/websearch/get_sources` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  // Extract sources array from response and filter to only include sources where include_in_result is true
  const allSources = data?.sources || []
  const includedSources = allSources.filter((source) => source.include_in_result)

  /**
   * Update the inclusion status of a websearch source with optimistic updates
   */
  const updateInclusion = async (sourceId: string, checked: boolean) => {
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
            `/api/flows/${flowId}/websearch/source/${sourceId}/include/${checked}`,
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
          if (!currentData?.sources) return currentData

          return {
            sources: currentData.sources.map((source) =>
              source.id === sourceId ? { ...source, include_in_result: checked } : source
            ),
          }
        },
        {
          // Optimistically show the updated state immediately
          optimisticData: data?.sources
            ? {
                sources: data.sources.map((source) =>
                  source.id === sourceId ? { ...source, include_in_result: checked } : source
                ),
              }
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
      setError(`Fout bij bijwerken van bron: ${err.message}`)
      return false
    }
  }

  return {
    sources: includedSources,
    allSources,
    isLoading,
    error: error || swrError,
    setError,
    updateInclusion,
    mutate,
  }
}
