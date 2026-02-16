/**
 * @type {import('next').NextConfig}
 */

import { PHASE_DEVELOPMENT_SERVER } from 'next/dist/shared/lib/constants.js'

const nextConfig = (phase) => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      env: {
        basePath: '',
      },
      turbopack: {
        root: process.cwd(),
      },
    }
  }

  return {
    env: {
      basePath: '',
    },
    images: { unoptimized: true },
    turbopack: {
      root: process.cwd(),
    },
  }
}

export default nextConfig
