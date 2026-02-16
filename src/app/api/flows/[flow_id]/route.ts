import { NextRequest, NextResponse } from 'next/server';
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils';

// GET /api/flows/:flow_id  →  GET {API_BASE_URL}/flows/{flow_id}
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ flow_id: string }> },
) {
  try {
    const baseUrl = ensureBaseUrl();
    const { flow_id } = await context.params;
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      );
    }

    const res = await fetch(`${baseUrl}/flows/${flow_id}`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Flow route error' },
      { status: 500 },
    );
  }
}

// PATCH /api/flows/:flow_id  →  PATCH {API_BASE_URL}/flows/{flow_id}
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ flow_id: string }> },
) {
  try {
    const baseUrl = ensureBaseUrl();
    const { flow_id } = await context.params;
    const token = await getAuthToken();
    const body = await req.json();

    if (!token) {
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      );
    }

    const res = await fetch(`${baseUrl}/flows/${flow_id}`, {
      method: 'PATCH',
      headers: createAuthHeaders(token),
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Flow route error' },
      { status: 500 },
    );
  }
}
