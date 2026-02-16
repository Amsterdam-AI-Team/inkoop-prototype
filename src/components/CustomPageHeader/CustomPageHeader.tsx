/**
 * @license EUPL-1.2+
 * Copyright Gemeente Amsterdam
 */

import type { AnchorHTMLAttributes, ComponentType, HTMLAttributes, ReactNode } from 'react'

import { clsx } from 'clsx'
import { forwardRef, useEffect, useState } from 'react'

import { Icon, Logo, PageHeader } from '@amsterdam/design-system-react'
import type { LogoBrand } from '@amsterdam/design-system-react'

// Import internals from the design system
// Note: These are not exported, so we reference them from the PageHeader namespace
const PageHeaderGridCellNarrowWindowOnly = PageHeader.GridCellNarrowWindowOnly
const PageHeaderMenuLink = PageHeader.MenuLink

// We need to import the menu icon - for now we'll use a simple SVG
const PageHeaderMenuIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
  </svg>
)

// Hook to check if we're after a breakpoint (simplified version)
const useIsAfterBreakpoint = (breakpoint: string) => {
  const [isAfter, setIsAfter] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)') // 'wide' breakpoint
    setIsAfter(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setIsAfter(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [breakpoint])

  return isAfter
}

type LogoLinkContentProps = {
  brandName?: string
  logoAccessibleName?: string
  logoBrand?: LogoBrand
}

const LogoLinkContent = ({ brandName, logoAccessibleName, logoBrand }: LogoLinkContentProps) => (
  <>
    <span
      className={clsx(logoBrand === 'amsterdam' && Boolean(brandName) && 'ams-page-header__logo-container')}
    >
      <Logo aria-label={logoAccessibleName} brand={logoBrand} />
    </span>
    {brandName && (
      <span aria-hidden="true" className="ams-page-header__brand-name">
        {brandName}
      </span>
    )}
  </>
)

export type CustomPageHeaderProps = {
  /** The name of the application. */
  brandName?: string
  /** A slot for breadcrumbs or other content below the header. */
  breadcrumb?: ReactNode
  /** Whether to hide the logo. */
  hideLogo?: boolean
  /** The accessible name of the logo. */
  logoAccessibleName?: string
  /** The name of the brand for which to display the logo. */
  logoBrand?: LogoBrand
  /** The url for the link on the logo. */
  logoLink?: string
  /** The React component to use for the logo link. */
  logoLinkComponent?: ComponentType<AnchorHTMLAttributes<HTMLAnchorElement>>
  /** The accessible text for the link on the logo. */
  logoLinkTitle?: string
  /** The text for the menu button. */
  menuButtonText?: string
  /** A slot for the menu items. Use PageHeader.MenuLink here. */
  menuItems?: ReactNode
  /** The accessible label for the navigation section. */
  navigationLabel?: string
  /** Whether the menu button is visible on wide screens.  */
  noMenuButtonOnWideWindow?: boolean
} & HTMLAttributes<HTMLElement>

const CustomPageHeaderRoot = forwardRef<HTMLElement, CustomPageHeaderProps>(
  (
    {
      brandName,
      breadcrumb,
      children,
      className,
      hideLogo = false,
      logoAccessibleName,
      logoBrand = 'amsterdam',
      logoLink = '/',
      logoLinkComponent = (props) => <a {...props} />,
      logoLinkTitle = `Ga naar de homepage${brandName ? ` van ${brandName}` : ''}`,
      menuButtonText = 'Menu',
      menuItems,
      navigationLabel = 'Hoofdnavigatie',
      noMenuButtonOnWideWindow,
      ...restProps
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false)
    const Link = logoLinkComponent
    const hasMegaMenu = Boolean(children)
    const isWideWindow = hasMegaMenu && useIsAfterBreakpoint('wide')

    useEffect(() => {
      // Close the menu when the menu button disappears
      if (noMenuButtonOnWideWindow && isWideWindow) {
        setOpen(false)
      }
    }, [isWideWindow, noMenuButtonOnWideWindow])

    return (
      <header {...restProps} className={clsx('ams-page-header', className)} ref={ref}>
        {!hideLogo ? (
          <Link className="ams-page-header__logo-link" href={logoLink}>
            <LogoLinkContent
              brandName={brandName}
              logoAccessibleName={logoAccessibleName}
              logoBrand={logoBrand}
            />
            <span className="ams-visually-hidden"> {logoLinkTitle}</span>
          </Link>
        ) : (
          breadcrumb && <div className="ams-page-header__logo-link">{breadcrumb}</div>
        )}
        {(hasMegaMenu || menuItems) && (
          <nav aria-labelledby="primary-navigation" className="ams-page-header__navigation">
            <h2 aria-hidden={true} className="ams-visually-hidden" id="primary-navigation">
              {navigationLabel}
            </h2>
            <div
              aria-hidden={true}
              className="ams-page-header__logo-link ams-page-header__logo-link--hidden"
              hidden
            >
              {!hideLogo && <LogoLinkContent brandName={brandName} logoBrand={logoBrand} />}
            </div>
              <ul className="ams-page-header__menu">
                {menuItems}
                {hasMegaMenu && (
                  <li
                    className={clsx(
                      noMenuButtonOnWideWindow &&
                        'ams-page-header__mega-menu-button-item--hide-on-wide-window',
                    )}
                  >
                    <button
                      aria-controls="ams-page-header-mega-menu"
                      aria-expanded={open}
                      className="ams-page-header__mega-menu-button"
                      onClick={() => setOpen(!open)}
                      type="button"
                    >
                      <span className="ams-page-header__mega-menu-button-label">{menuButtonText}</span>
                      <span aria-hidden={true} className="ams-page-header__mega-menu-button-hidden-label">
                        {menuButtonText}
                      </span>
                      <Icon
                        svg={
                          <PageHeaderMenuIcon
                            className={clsx('ams-page-header__menu-icon', open && 'ams-page-header__menu-icon--open')}
                          />
                        }
                      />
                    </button>
                  </li>
                )}
              </ul>
              {hasMegaMenu && (
                <div
                  className={clsx('ams-page-header__mega-menu', !open && 'ams-page-header__mega-menu--closed')}
                  id="ams-page-header-mega-menu"
                >
                  {children}
                </div>
              )}
            </nav>
          )}
      </header>
    )
  },
)

CustomPageHeaderRoot.displayName = 'CustomPageHeader'

/**
 * Custom PageHeader component based on Amsterdam Design System PageHeader
 * with support for hiding the logo and adding breadcrumbs.
 */
export const CustomPageHeader = Object.assign(CustomPageHeaderRoot, {
  GridCellNarrowWindowOnly: PageHeaderGridCellNarrowWindowOnly,
  MenuLink: PageHeaderMenuLink,
})
