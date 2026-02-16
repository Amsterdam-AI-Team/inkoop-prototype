import { useFlow } from './useInkoopData'

/**
 * Hook for flow mutations including status updates
 */
export function useFlowMutations(flowId: string | null) {
  const { flow, mutate } = useFlow(flowId)

  /**
   * Updates flow status to 'in-progress' if current status is 'pending'
   * Uses optimistic updates for immediate UI feedback
   */
  const markFlowInProgress = async () => {
    if (!flowId || !flow) {
      return
    }

    // Only update if current status is 'pending'
    if (flow.status !== 'pending') {
      return
    }

    // Optimistically update the cache
    mutate(
      (current) => current ? { ...current, status: 'in-progress' as const } : current,
      { revalidate: false }
    )

    try {
      const res = await fetch(`/api/flows/${flowId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'in-progress' }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.warn('Failed to update flow status:', body)
        // Rollback on error
        mutate()
        return
      }

      const updatedFlow = await res.json()
      // Update cache with server response
      mutate(updatedFlow, { revalidate: false })
    } catch (err) {
      console.warn('Error updating flow status:', err)
      // Rollback on error
      mutate()
    }
  }

  return {
    markFlowInProgress,
  }
}
