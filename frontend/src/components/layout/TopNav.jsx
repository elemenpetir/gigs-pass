import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const TopNav = forwardRef(({
  logo,
  links = [],
  right,
  className,
  ...props
}, ref) => (
  <header
    className={cn(
      'sticky top-0 z-50 w-full bg-canvas border-b-4 border-foreground',
      className
    )}
    ref={ref}
    {...props}
  >
    <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row md:items-center justify-between p-4 md:px-8">
      <div className="flex items-center gap-8 md:gap-12 mb-4 md:mb-0">
        {logo ? (
          <div className="text-3xl md:text-5xl font-black tracking-tighter leading-none">{logo}</div>
        ) : (
          <a href="/" className="text-3xl md:text-5xl font-black tracking-tighter leading-none flex items-center">
            <span className="bg-foreground text-background px-2 py-1 brut-border-2 border-transparent rotate-[-2deg] mr-1">GIGS</span>
            PASS<span className="text-gigs-pink">.</span>
          </a>
        )}

        {links.length > 0 && (
          <nav className="hidden md:flex gap-6 font-bold text-lg uppercase tracking-tight">
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                className="hover:text-gigs-pink transition-colors relative"
              >
                {link.label}
                {link.badge && (
                  <span className="absolute -top-3 -right-4 text-[10px] bg-gigs-yellow px-1 brut-border-2 rotate-6">
                    {link.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>
        )}
      </div>

      {right && (
        <div className="flex items-center gap-4 font-bold uppercase text-sm md:text-base">
          {right}
        </div>
      )}
    </div>
  </header>
))

TopNav.displayName = 'TopNav'

export { TopNav }
