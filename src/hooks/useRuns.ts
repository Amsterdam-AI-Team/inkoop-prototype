import useSWR from 'swr'
import { Run, RunWithGenerations } from './useInkoopData'

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    const error = new Error('Failed to fetch')
    throw error
  }

  return res.json()
}

/**
 * Hook to fetch all runs for a flow with SWR caching
 */
export function useRuns(flowId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Run[]>(
    flowId ? `/api/flows/${flowId}/runs` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  return {
    runs: data,
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * Hook to fetch a specific run with its generations
 */
export function useRun(flowId: string | null, runId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<RunWithGenerations>(
    flowId && runId ? `/api/flows/${flowId}/runs/${runId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  return {
    runData: data,
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * Trigger a new run for the flow
 * Returns the run response from the backend
 */
export async function triggerRun(flowId: string): Promise<{
  status: string
  message: string
  flow_id: string
  documents_used: number
  web_sources_used: number
}> {
  const res = await fetch(`/api/flows/${flowId}/runs`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to trigger run' }))
    throw new Error(errorData.detail || 'Failed to trigger run')
  }

  return res.json()
}

/**
 * Save edited generation text
 * Returns the updated generation from the backend
 */
export async function saveEditedGeneration(
  generationId: string,
  editedText: string
): Promise<{ status: string; message: string; generation_id: string }> {
  const res = await fetch(`/api/generations/${generationId}/edit`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      edited_text: editedText,
    }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to save edited generation' }))
    throw new Error(errorData.detail || 'Failed to save edited generation')
  }

  return res.json()
}
