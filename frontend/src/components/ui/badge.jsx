import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const variantStyles = {
  default: 'bg-surface-card text-ink border border-hairline',
  primary: 'bg-primary text-on-primary',
  success: 'bg-success text-on-primary',
  warning: 'bg-warning text-ink',
  error: 'bg-error text-on-primary',
  pink: 'bg-brand-pink text-on-primary',
  teal: 'bg-brand-teal text-on-dark',
  ochre: 'bg-brand-ochre text-ink',
}

const Badge = forwardRef(({ 
  className,
  variant = 'default',
  disabled = false,
  ...props 
}, ref) => (
  <span
    className={cn(
      'inline-flex items-center rounded-pill px-3 py-1.5 text-caption font-medium border border-transparent',
      variantStyles[variant],
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}
    ref={ref}
    {...props}
  />
))

Badge.displayName = 'Badge'

export { Badge }
