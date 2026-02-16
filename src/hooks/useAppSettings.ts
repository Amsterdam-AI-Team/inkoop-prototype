import useSWR from 'swr'

export interface AppSettings {
  brand_name: string
}

const fetcher = async (url: string): Promise<AppSettings> => {
  const res = await fetch(url)
  if (!res.ok) {
    // Return defaults on error
    return {
      brand_name: 'Schrijfhulp',
    }
  }
  return res.json()
}

export function useAppSettings() {
  const { data, error, isLoading } = useSWR<AppSettings>('/api/settings', fetcher, {
    // Cache settings for the duration of the session
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    // Fallback data in case of error
    fallbackData: {
      brand_name: 'Schrijfhulp',
    },
  })

  return {
    settings: data ?? { brand_name: 'Schrijfhulp' },
    isLoading,
    error,
  }
}
