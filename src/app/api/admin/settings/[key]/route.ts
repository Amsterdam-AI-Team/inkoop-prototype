import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ key: string }> },
) {
  try {
    const baseUrl = ensureBaseUrl()
    const { key } = await context.params
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      )
    }

    const body = await req.json()

    const res = await fetch(`${baseUrl}/admin/settings/${key}`, {
      method: 'PATCH',
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
