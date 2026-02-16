// src/app/api/collections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils';

// GET /api/collections  →  GET {API_BASE_URL}/collections
export async function GET(_req: NextRequest) {
  try {
    const baseUrl = ensureBaseUrl();
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      );
    }

    const res = await fetch(`${baseUrl}/collections`, {
      headers: createAuthHeaders(token),
      method: 'GET',
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Collections route error' },
      { status: 500 },
    );
  }
}

// POST /api/collections  →  POST {API_BASE_URL}/collections
export async function POST(req: NextRequest) {
  try {
    const baseUrl = ensureBaseUrl();
    const token = await getAuthToken();
    const body = await req.json(); // { name, description? }

    console.log('[API] POST /api/collections - baseUrl:', baseUrl);
    console.log('[API] POST /api/collections - body:', body);

    if (!token) {
      console.log('[API] POST /api/collections - No token found');
      return NextResponse.json(
        { detail: 'Missing Authorization header' },
        { status: 401 },
      );
    }

    const url = `${baseUrl}/collections`;
    console.log('[API] POST /api/collections - Calling backend:', url);

    const res = await fetch(url, {
      method: 'POST',
      headers: createAuthHeaders(token),
      body: JSON.stringify(body),
    });

    console.log('[API] POST /api/collections - Backend response status:', res.status);

    const data = await res.json().catch(() => ({}));
    console.log('[API] POST /api/collections - Backend response data:', data);

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[API] POST /api/collections - Error:', err);
    return NextResponse.json(
      { detail: err.message ?? 'Collections route error' },
      { status: 500 },
    );
  }
}
