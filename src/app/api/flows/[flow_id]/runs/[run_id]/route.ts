import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ flow_id: string; run_id: string }> }
) {
  try {
    const baseUrl = ensureBaseUrl()
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json({ detail: 'Missing Authorization header' }, { status: 401 })
    }

    const { flow_id, run_id } = await params

    const res = await fetch(`${baseUrl}/flows/${flow_id}/runs/${run_id}`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })

    const data = await res.json().catch(() => ({}))

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ detail: err.message ?? 'Route error' }, { status: 500 })
  }
}
