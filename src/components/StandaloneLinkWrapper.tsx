'use client'

import { StandaloneLink } from '@amsterdam/design-system-react/dist/StandaloneLink'
import { NextLinkWrapper } from './NextLinkWrapper'
import type { ComponentProps } from 'react'

type StandaloneLinkWrapperProps = {
  href: string
} & Omit<ComponentProps<typeof StandaloneLink>, 'href'>

/**
 * StandaloneLink component wrapped with Next.js Link for client-side navigation.
 * Preserves all StandaloneLink props (color, icon, etc.) and Amsterdam Design System styling.
 */
export function StandaloneLinkWrapper({ href, ...props }: StandaloneLinkWrapperProps) {
  return <NextLinkWrapper href={href} component={StandaloneLink} {...props} />
}
