'use client'

import type { MenuProps } from '@amsterdam/design-system-react'

import { IconButton, Menu } from '@amsterdam/design-system-react'
import {
  ArrowForwardIcon,
  BarChartIcon,
  DocumentsIcon,
  QuestionMarkCircleIcon,
  FolderIcon,
  LockClosedIcon,
  PersonIcon,
  PieChartIcon,
  LogOutIcon,
} from '@amsterdam/design-system-react-icons'
import { useAuth } from '@/contexts/AuthContext'

const topMenuItems = [
  // {
  //   href: '/inkoop',
  //   icon: <PieChartIcon />,
  //   text: 'Dashboard',
  // },
  // {
  //   href: '#',
  //   icon: <FolderIcon />,
  //   text: 'Contracten',
  // },
  {
    href: '/',
    icon: <DocumentsIcon />,
    text: 'Mijn projecten',
  },
]

const bottomMenuItems = [
  {
    href: '/help',
    icon: <QuestionMarkCircleIcon />,
    text: 'Help',
  },
]

type InkoopMenuProps = {
  className?: string
  inWideWindow?: MenuProps['inWideWindow']
}

export function InkoopMenu({ className, inWideWindow }: InkoopMenuProps) {
  const { user } = useAuth()

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      // Redirect to login regardless of API call success
      window.location.href = '/login'
    }
  }

  return (
    <div className={`inkoop-menu-wrapper ${className || ''}`}>
      <Menu inWideWindow={inWideWindow}>
        {topMenuItems.map(({ href, icon, text }) => (
          <Menu.Link href={href} icon={icon} key={text}>
            {text}
          </Menu.Link>
        ))}
      </Menu>
      <div className="inkoop-menu-bottom">
        <Menu inWideWindow={inWideWindow}>
          {bottomMenuItems.map(({ href, icon, text }) => (
            <Menu.Link href={href} icon={icon} key={text}>
              {text}
            </Menu.Link>
          ))}
          <Menu.Link href="/account" icon={<PersonIcon />}>
            Account
          </Menu.Link>
          {user?.is_admin && (
            <Menu.Link href="/admin" icon={<LockClosedIcon />}>
              Admin
            </Menu.Link>
          )}
          <Menu.Link
            icon={<LogOutIcon />}
            onClick={(e) => {
              e.preventDefault()
              handleLogout()
            }}
            style={{ cursor: 'pointer' }}
          >
            Uitloggen
          </Menu.Link>
        </Menu>
      </div>
    </div>
  )
}
