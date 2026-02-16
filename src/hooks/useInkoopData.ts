import useSWR from 'swr'

export interface Collection {
  id: string
  user_id: string
  name: string
  status: 'pending' | 'in-progress' | 'done'
  description?: string | null
  created_at: string
  updated_at: string
}

export interface Flow {
  id: string
  collection_id: string
  name: string
  description: string | null
  template_name: string
  template_content: string
  context_content: string | null
  status: 'pending' | 'in-progress' | 'done'
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  flow_id: string
  title: string
  original_filename: string
  mime_type: string
  original_size_bytes: number
  text_bytes: number
  sha256: string
  tags: string[]
  storage_path: string
  created_at: string
  updated_at: string
}

export interface Run {
  id: string
  flow_id: string
  status: 'running' | 'succeeded' | 'failed'
  variables: Record<string, any>
  selected_document_ids: string[]
  started_at: string
  finished_at: string | null
  error: string | null
  created_at: string
  edited_at?: string
  is_user_edited?: boolean
  edited_response?: string
}

export interface Generation {
  id: string
  flow_run_id: string
  model_name: string
  prompt: string
  response: string
  tokens_prompt: number | null
  tokens_completion: number | null
  latency_ms: number | null
  created_at: string
}

export interface RunWithGenerations {
  run: Run
  generations: Generation[]
}

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  // Redirect to login on authentication errors
  if (res.status === 401 || res.status === 403) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    const error = new Error('Unauthorized')
    throw error
  }

  if (!res.ok) {
    const error = new Error('Failed to fetch')
    throw error
  }

  return res.json()
}

/**
 * Hook to fetch collection data with SWR caching
 */
export function useCollection(collectionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Collection>(
    collectionId ? `/api/collections/${collectionId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  return {
    collection: data,
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * Hook to fetch flow data with SWR caching
 */
export function useFlow(flowId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Flow>(
    flowId ? `/api/flows/${flowId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  return {
    flow: data,
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * Hook to fetch flows for a collection with SWR caching
 */
export function useFlows(collectionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Flow[]>(
    collectionId ? `/api/collections/${collectionId}/flows` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  return {
    flows: data,
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * Hook to fetch all collections for the current user with SWR caching
 */
export function useCollections() {
  const { data, error, isLoading, mutate } = useSWR<Collection[]>(
    '/api/collections',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  return {
    collections: data,
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * Hook to fetch documents for a flow with SWR caching
 */
export function useDocuments(flowId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Document[]>(
    flowId ? `/api/flows/${flowId}/documents` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  )

  return {
    documents: data,
    isLoading,
    isError: error,
    mutate,
  }
}
