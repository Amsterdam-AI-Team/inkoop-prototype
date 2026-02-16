import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'

// GET /api/flows/:flow_id/documents  →  GET {API_BASE_URL}/flows/{flow_id}/documents
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ flow_id: string }> },
) {
  try {
    const baseUrl = ensureBaseUrl()
    const { flow_id } = await context.params
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      )
    }

    const res = await fetch(`${baseUrl}/flows/${flow_id}/documents`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })

    const data = await res.json().catch(() => ([]))

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Documents route error' },
      { status: 500 },
    )
  }
}

// POST /api/flows/:flow_id/documents  →  POST {API_BASE_URL}/flows/{flow_id}/documents
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ flow_id: string }> },
) {
  try {
    const baseUrl = ensureBaseUrl()
    const { flow_id } = await context.params
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      )
    }

    // Get the FormData from the request
    const formData = await req.formData()

    // Forward the FormData to the backend with auth headers
    const res = await fetch(`${baseUrl}/flows/${flow_id}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type - let fetch set it with the boundary for multipart/form-data
      },
      body: formData,
    })

    const data = await res.json().catch(() => ({}))

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Document upload error' },
      { status: 500 },
    )
  }
}
