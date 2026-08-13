import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Footer = forwardRef(({
  brand = 'GIGS PASS.',
  tagline,
  columns = [],
  bottom,
  className,
  ...props
}, ref) => (
  <footer
    className={cn(
      'w-full bg-gigs-pink border-t-4 border-foreground',
      className
    )}
    ref={ref}
    {...props}
  >
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-16 pb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16 text-foreground">
        {/* Brand Column */}
        <div>
          <h2 className="text-4xl font-black tracking-tighter leading-none mb-6 uppercase">
            {brand}
          </h2>
          {tagline && <p className="font-bold max-w-xs">{tagline}</p>}
        </div>

        {/* Links Columns */}
        {columns.map((column, idx) => (
          <div key={idx}>
            {column.title && (
              <h4 className="font-black text-xl mb-4 uppercase">{column.title}</h4>
            )}
            <ul className="space-y-2 font-bold">
              {column.items?.map((item, itemIdx) => (
                <li key={itemIdx}>
                  <a
                    href={item.href}
                    className="hover:underline underline-offset-4"
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
      {bottom && (
        <div className="border-t-4 border-foreground pt-8 flex flex-col md:flex-row justify-between items-center font-bold text-sm">
          {bottom}
        </div>
      )}
    </div>
  </footer>
))

Footer.displayName = 'Footer'

export { Footer }
