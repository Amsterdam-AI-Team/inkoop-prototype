import { NextResponse } from 'next/server'
import { ensureBaseUrl } from '@/lib/api/utils'

/**
 * Public endpoint to get app settings that are safe to expose to all users
 * (brand_name)
 *
 * Note: This proxies to the backend API settings endpoint
 */
export async function GET() {
  try {
    const baseUrl = ensureBaseUrl()
    const response = await fetch(`${baseUrl}/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Error fetching settings from backend:', err)
    // On error, return defaults
    return NextResponse.json({
      brand_name: 'Schrijfhulp',
    })
  }
}
