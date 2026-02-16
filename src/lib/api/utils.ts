import { cookies } from 'next/headers';

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;

export function ensureBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL (of NEXT_PUBLIC_API_BASE_URL) is niet ingesteld.');
  }
  return API_BASE_URL.replace(/\/+$/, '');
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('accessToken')?.value;
}

export function createAuthHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
