import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL; // zet deze in je .env

export async function POST(req: NextRequest) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { detail: 'API_BASE_URL is niet ingesteld op de server.' },
      { status: 500 },
    );
  }

  const body = await req.json(); // { email, password }

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  // Als backend een foutstatus geeft, geef die gewoon door
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const token = data.access_token || data.token;

  if (token) {
    const cookieStore = await cookies();

    cookieStore.set('accessToken', token, {
      httpOnly: true,
      secure: req.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
  }

  // Succes: stuur TokenResponse terug naar de client, maar zonder het token in de body als we cookies gebruiken
  // We sturen data.user mee als dat bestaat, of gewoon success
  return NextResponse.json(
    { success: true, user: data.user || undefined },
    { status: 200 },
  );
}
