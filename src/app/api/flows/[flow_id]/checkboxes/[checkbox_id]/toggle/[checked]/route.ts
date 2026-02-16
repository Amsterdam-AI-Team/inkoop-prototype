import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'

export async function POST(
  _req: NextRequest,
  context: {
    params: Promise<{
      flow_id: string
      checkbox_id: string
      checked: string
    }>
  },
) {
  try {
    const baseUrl = ensureBaseUrl()
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      )
    }

    const { flow_id, checkbox_id, checked } = await context.params

    // Convert string 'true'/'false' to boolean
    const checkedBool = checked === 'true'

    const res = await fetch(
      `${baseUrl}/flows/${flow_id}/checkboxes/${checkbox_id}/toggle/${checkedBool}`,
      {
        method: 'POST',
        headers: createAuthHeaders(token),
      },
    )

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Failed to toggle checkbox' },
      { status: 500 },
    )
  }
}
