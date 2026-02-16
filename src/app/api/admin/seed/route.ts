import { NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'
import fs from 'fs'
import path from 'path'

export async function POST() {
  try {
    const baseUrl = ensureBaseUrl()
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      )
    }

    const inkoopSettingsPath = path.join(process.cwd(), 'src/lib/seeds/inkoop-settings.json')
    const inkoopSettings = JSON.parse(fs.readFileSync(inkoopSettingsPath, 'utf-8'))

    const body = {
      settings: inkoopSettings.settings,
      collection_templates: inkoopSettings.collection_templates,
    }

    const res = await fetch(`${baseUrl}/admin/seed`, {
      method: 'POST',
      headers: createAuthHeaders(token),
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))

    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message ?? 'Server error' },
      { status: 500 },
    )
  }
}
