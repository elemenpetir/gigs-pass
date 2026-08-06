import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const TopNav = forwardRef(({ 
  logo,
  links = [],
  actionButton,
  className,
  ...props 
}, ref) => (
  <nav
    className={cn(
      'sticky top-0 z-50 w-full bg-canvas border-b border-hairline',
      'h-16 px-6 flex items-center justify-between',
      className
    )}
    ref={ref}
    {...props}
  >
    <div className="flex items-center gap-8">
      {logo && <div className="text-title-lg font-display">{logo}</div>}
      
      {links.length > 0 && (
        <ul className="hidden md:flex items-center gap-6">
          {links.map((link, idx) => (
            <li key={idx}>
              <a
                href={link.href}
                className="text-nav-link text-body hover:text-primary transition-colors duration-fast"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>

    {actionButton && (
      <div className="flex items-center gap-3">
        {actionButton}
      </div>
    )}
  </nav>
))

TopNav.displayName = 'TopNav'

export { TopNav }
