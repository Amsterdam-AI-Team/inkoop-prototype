'use client'

import NextLink from 'next/link'
import { ComponentType, forwardRef } from 'react'

type NextLinkWrapperProps<T extends Record<string, any>> = T & {
  href: string
  component: ComponentType<T>
}

/**
 * Generic wrapper that combines Next.js Link with any component that expects an <a> tag.
 * Useful for design system components like StandaloneLink, Button-as-link, etc.
 *
 * @example
 * ```tsx
 * <NextLinkWrapper
 *   href="/page"
 *   component={StandaloneLink}
 * >
 *   Link text
 * </NextLinkWrapper>
 * ```
 */
export function NextLinkWrapper<T extends Record<string, any>>({
  href,
  component: Component,
  ...props
}: NextLinkWrapperProps<T>) {
  return (
    <NextLink href={href} legacyBehavior passHref>
      <Component {...(props as unknown as T)} />
    </NextLink>
  )
}
