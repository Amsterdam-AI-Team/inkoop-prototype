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

    const res = await fetch(`${baseUrl}/collections/${collection_id}`, {
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

export async function PATCH(
  req: NextRequest,
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

    const body = await req.json(); // bv. { name?: string, description?: string }

    const res = await fetch(`${baseUrl}/collections/${collection_id}`, {
      body: JSON.stringify(body),
      headers: createAuthHeaders(token),
      method: 'PATCH',
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

export async function DELETE(
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

    const res = await fetch(`${baseUrl}/collections/${collection_id}`, {
      headers: createAuthHeaders(token),
      method: 'DELETE',
    });

    // 204 No Content has no body to parse
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Collection delete error' },
      { status: 500 },
    );
  }
}