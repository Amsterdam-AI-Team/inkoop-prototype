import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ flow_id: string }> }) {
  try {
    const baseUrl = ensureBaseUrl()
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json({ detail: 'Missing Authorization header' }, { status: 401 })
    }

    const { flow_id } = await params

    const res = await fetch(`${baseUrl}/flows/${flow_id}/runs`, {
      method: 'POST',
      headers: createAuthHeaders(token),
    })

    const data = await res.json().catch(() => ({}))

    // If the backend request failed, include more context in the error
    if (!res.ok) {
      const errorDetail = data.detail || `Backend error: ${res.status} ${res.statusText}`
      return NextResponse.json({ detail: errorDetail }, { status: res.status })
    }

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    const errorMessage = err.message ?? 'Route error'
    console.error('Error in POST /api/flows/[flow_id]/runs:', errorMessage, err)
    return NextResponse.json(
      { detail: `Fout bij verbinden met backend: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ flow_id: string }> }) {
  try {
    const baseUrl = ensureBaseUrl()
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json({ detail: 'Missing Authorization header' }, { status: 401 })
    }

    const { flow_id } = await params

    const res = await fetch(`${baseUrl}/flows/${flow_id}/runs`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })

    const data = await res.json().catch(() => [])

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ detail: err.message ?? 'Route error' }, { status: 500 })
  }
}
