'use client'

import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

type User = {
  display_name?: string
  email: string
  id: string
  is_admin?: boolean
}

type AuthContextType = {
  isLoading: boolean
  user: User | null
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  user: null,
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else if (res.status === 401) {
        setUser(null)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Failed to fetch user:', err)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshUser = async () => {
    setIsLoading(true)
    await fetchUser()
  }

  useEffect(() => {
    fetchUser()
  }, [])

  // Don't render children until initial auth check is complete
  // This prevents pages from trying to fetch data before we know auth status
  if (isLoading) {
    return null
  }

  return <AuthContext.Provider value={{ isLoading, user, refreshUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
