import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    // Basic JWT decoding (Header.Payload.Signature)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const response = NextResponse.json({ user: null }, { status: 401 });
      // Clear the expired cookie
      response.cookies.set('accessToken', '', { maxAge: 0 });
      return response;
    }

    // Map JWT claims to a user object
    const user = {
      id: payload.sub,
      email: payload.email,
      is_admin: payload.is_admin || false,
    };

    return NextResponse.json({ user });
  } catch (error) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    // Clear the invalid cookie
    response.cookies.set('accessToken', '', { maxAge: 0 });
    return response;
  }
}
