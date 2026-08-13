import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const colorVariants = {
  pink: 'bg-gigs-pink text-foreground',
  teal: 'bg-gigs-dark text-background',
  lavender: 'bg-gigs-purple text-ink',
  peach: 'bg-gigs-orange text-ink',
  ochre: 'bg-gigs-yellow text-ink',
  mint: 'bg-gigs-teal text-ink',
}

const colorOrder = ['pink', 'teal', 'lavender', 'peach', 'ochre', 'mint']

const FeatureCard = forwardRef(({
  title,
  description,
  color = 'pink',
  icon,
  children,
  className,
  previousColor,
  ...props
}, ref) => {
  if (!Object.keys(colorVariants).includes(color)) {
    console.warn(`Invalid feature card color: ${color}. Use one of: ${Object.keys(colorVariants).join(', ')}`)
  }

  if (previousColor && previousColor === color) {
    console.warn(`Color repeat detected: ${color}. Feature card colors should cycle: pink → teal → lavender → peach → ochre → mint → repeat`)
  }

  return (
    <div
      className={cn(
        'rounded-none border-4 border-foreground p-8 brut-shadow brut-card-hover',
        colorVariants[color],
        className
      )}
      ref={ref}
      {...props}
    >
      {icon && <div className="mb-4 text-2xl">{icon}</div>}
      {title && <h3 className="text-title-lg font-display mb-2">{title}</h3>}
      {description && <p className="text-body-md opacity-90 mb-4">{description}</p>}
      {children}
    </div>
  )
})

FeatureCard.displayName = 'FeatureCard'

export { FeatureCard, colorOrder }
