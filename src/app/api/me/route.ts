import { NextResponse } from 'next/server';
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils';

export async function GET() {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const baseUrl = ensureBaseUrl();
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: createAuthHeaders(token),
    });

    if (!res.ok) {
      const response = NextResponse.json({ user: null }, { status: 401 });
      if (res.status === 401) {
        response.cookies.set('accessToken', '', { maxAge: 0 });
      }
      return response;
    }

    const user = await res.json();
    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json(
      { user: null, detail: err.message ?? 'Auth error' },
      { status: 500 },
    );
  }
}
