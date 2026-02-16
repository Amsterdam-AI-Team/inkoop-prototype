import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'

// DELETE /api/flows/:flow_id/documents/:document_id  →  DELETE {API_BASE_URL}/flows/{flow_id}/documents/{document_id}
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ flow_id: string; document_id: string }> },
) {
  try {
    const baseUrl = ensureBaseUrl()
    const { flow_id, document_id } = await context.params
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      )
    }

    const res = await fetch(`${baseUrl}/flows/${flow_id}/documents/${document_id}`, {
      method: 'DELETE',
      headers: createAuthHeaders(token),
    })

    // Backend returns 204 No Content for successful DELETE (no body)
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    // For other status codes, try to parse JSON (e.g., error responses)
    const data = await res.json().catch(() => ({}))

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Document delete error' },
      { status: 500 },
    )
  }
}
