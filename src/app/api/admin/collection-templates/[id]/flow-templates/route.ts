import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const baseUrl = ensureBaseUrl()
    const { id } = await context.params
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      )
    }

    const body = await req.json()

    const res = await fetch(`${baseUrl}/admin/collection-templates/${id}/flow-templates`, {
      method: 'POST',
      headers: createAuthHeaders(token),
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Server error' },
      { status: 500 },
    )
  }
}
