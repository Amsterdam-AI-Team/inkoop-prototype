import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'

export async function GET(
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

    const res = await fetch(`${baseUrl}/flows/${flow_id}/websearch/status`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })

    const data = await res.json().catch(() => ({}))

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Websearch status route error' },
      { status: 500 },
    )
  }
}
