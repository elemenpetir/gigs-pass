import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const colorVariants = {
  pink: 'bg-brand-pink text-on-primary',
  teal: 'bg-brand-teal text-on-dark',
  lavender: 'bg-brand-lavender text-ink',
  peach: 'bg-brand-peach text-ink',
  ochre: 'bg-brand-ochre text-ink',
  mint: 'bg-brand-mint text-ink',
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
        'rounded-xl p-8 transition-all duration-base',
        'hover:scale-103 hover:shadow-lg hover:-translate-y-1',
        colorVariants[color],
        className
      )}
      ref={ref}
      {...props}
    >
      {icon && <div className="mb-4 text-2xl">{icon}</div>}
      {title && <h3 className="text-title-md font-display mb-2">{title}</h3>}
      {description && <p className="text-body-md opacity-90 mb-4">{description}</p>}
      {children}
    </div>
  )
})

FeatureCard.displayName = 'FeatureCard'

export { FeatureCard, colorOrder }
