import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const colorVariants = {
  default: 'bg-surface-card text-ink border border-hairline',
  pink: 'bg-brand-pink text-on-primary border-brand-pink',
  teal: 'bg-brand-teal text-on-dark border-brand-teal',
  lavender: 'bg-brand-lavender text-ink border-brand-lavender',
  peach: 'bg-brand-peach text-ink border-brand-peach',
  ochre: 'bg-brand-ochre text-ink border-brand-ochre',
  mint: 'bg-brand-mint text-ink border-brand-mint',
}

const Card = forwardRef(({ 
  className,
  variant = 'default',
  interactive = false,
  ...props 
}, ref) => (
  <div
    className={cn(
      'rounded-lg p-6 border transition-all duration-base',
      interactive && 'hover:scale-103 hover:shadow-lg hover:-translate-y-1 cursor-pointer',
      colorVariants[variant],
      className
    )}
    ref={ref}
    {...props}
  />
))

Card.displayName = 'Card'

export { Card }
