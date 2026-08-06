import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Footer = forwardRef(({ 
  logo,
  description,
  links = [],
  social,
  copyright,
  className,
  ...props 
}, ref) => (
  <footer
    className={cn(
      'w-full bg-surface-soft border-t border-hairline',
      'px-6 py-16',
      className
    )}
    ref={ref}
    {...props}
  >
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        {/* Brand Column */}
        <div className="md:col-span-1">
          {logo && <div className="text-title-lg font-display mb-2">{logo}</div>}
          {description && <p className="text-body-sm text-muted">{description}</p>}
        </div>

        {/* Links Columns */}
        {links.map((column, idx) => (
          <div key={idx}>
            {column.title && (
              <h4 className="text-title-sm font-medium mb-4 text-ink">{column.title}</h4>
            )}
            <ul className="space-y-2">
              {column.items?.map((item, itemIdx) => (
                <li key={itemIdx}>
                  <a
                    href={item.href}
                    className="text-body-sm text-muted hover:text-primary transition-colors duration-fast"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="border-t border-hairline pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {copyright && (
          <p className="text-body-sm text-muted">{copyright}</p>
        )}
        
        {social && (
          <div className="flex items-center gap-4">
            {social}
          </div>
        )}
      </div>
    </div>
  </footer>
))

Footer.displayName = 'Footer'

export { Footer }
