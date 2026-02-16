import { NextRequest, NextResponse } from 'next/server';
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ collection_id: string }> },
) {
  try {
    const baseUrl = ensureBaseUrl();
    const { collection_id } = await context.params;
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      );
    }

    const res = await fetch(`${baseUrl}/collections/${collection_id}/flows`, {
      headers: createAuthHeaders(token),
      method: 'GET',
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Flows route error' },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ collection_id: string }> },
) {
  console.log('[API] POST /api/collections/[collection_id]/flows - START');

  try {
    const baseUrl = ensureBaseUrl();
    const { collection_id } = await context.params;
    const token = await getAuthToken();
    const body = await req.json();

    console.log('[API] POST flows - baseUrl:', baseUrl);
    console.log('[API] POST flows - collection_id:', collection_id);
    console.log('[API] POST flows - body:', body);

    if (!token) {
      console.log('[API] POST flows - No token found');
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      );
    }

    const url = `${baseUrl}/collections/${collection_id}/flows`;
    console.log('[API] POST flows - Calling backend:', url);

    const res = await fetch(url, {
      method: 'POST',
      headers: createAuthHeaders(token),
      body: JSON.stringify(body),
    });

    console.log('[API] POST flows - Backend response status:', res.status);

    const data = await res.json().catch(() => ({}));
    console.log('[API] POST flows - Backend response data:', data);

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[API] POST flows - Error:', err);
    return NextResponse.json(
      { detail: err.message ?? 'Flow creation error' },
      { status: 500 },
    );
  }
}
