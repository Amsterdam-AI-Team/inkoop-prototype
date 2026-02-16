'use client'

import { Breadcrumb, Badge } from '@amsterdam/design-system-react'
import NextLink from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { capitalize } from '@/utils/string'
import { useCollection, useFlow } from '@/hooks/useInkoopData'
import { useAppSettings } from '@/hooks/useAppSettings'

export function InkoopBreadcrumb() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { settings } = useAppSettings()

  // Get IDs from query params
  const collectionId = searchParams.get('collectionId') || searchParams.get('id')
  const flowId = searchParams.get('flowId')

  // Use SWR hooks for data fetching with automatic caching and deduplication
  const { collection: collectionData, isLoading: isLoadingCollection } = useCollection(collectionId)
  const { flow: flowData, isLoading: isLoadingFlow } = useFlow(flowId)

  // Build breadcrumb items based on current pathname and query params
  let breadcrumbItems: Array<{ href: string; label: string }> = []

  // Home page: just brand name
  if (pathname === '/') {
    breadcrumbItems = [{ href: '/', label: settings.brand_name }]
  }
  // Handle /project/new/[collection_type]
  else if (pathname.startsWith('/project/new/')) {
    breadcrumbItems = [
      { href: '/', label: settings.brand_name },
      { href: pathname, label: 'Naamloos project' },
    ]
  }
  // Handle project pages
  else if (
    pathname === '/project/concepttekst' ||
    pathname === '/project/bronnen' ||
    pathname === '/project/instructie' ||
    pathname === '/project'
  ) {
    // Always start with home
    breadcrumbItems = [{ href: '/', label: settings.brand_name }]

    // Add project name if we have a collection
    if (collectionId && collectionData) {
      breadcrumbItems.push({
        href: `/project?collectionId=${collectionId}`,
        label: collectionData.name,
      })
    }

    // Add flow name if we have a flowId and we're on a flow page (not just /project)
    if (flowId && flowData && pathname !== '/project') {
      breadcrumbItems.push({
        href: `/project/instructie?flowId=${flowId}&collectionId=${collectionId}`,
        label: capitalize(flowData.name),
      })
    }
  }
  // Fallback to home
  else {
    breadcrumbItems = [{ href: '/', label: settings.brand_name }]
  }

  const isNewProjectPage = pathname === '/project/new'

  // Check if we're still loading required data before rendering
  const needsCollectionData = collectionId !== null && pathname !== '/project/new'
  const needsFlowData = flowId !== null && pathname !== '/project'

  if (needsCollectionData && (isLoadingCollection || !collectionData)) {
    return null
  }

  if (needsFlowData && (isLoadingFlow || !flowData)) {
    return null
  }

  return (
    <Breadcrumb>
      {breadcrumbItems.map((item, index) => {
        const isHome = item.href === '/'
        const showBadge = isHome && isNewProjectPage
        const isCurrent = index === breadcrumbItems.length - 1

        return (
          <NextLink href={item.href} key={item.href} legacyBehavior passHref>
            <Breadcrumb.Link>
              {isCurrent ? <strong>{item.label}</strong> : item.label}
              {showBadge && (
                <>
                  {' '}
                  <Badge label="nieuw project" style={{ fontSize: '0.75em' }} />
                </>
              )}
            </Breadcrumb.Link>
          </NextLink>
        )
      })}
    </Breadcrumb>
  )
}
