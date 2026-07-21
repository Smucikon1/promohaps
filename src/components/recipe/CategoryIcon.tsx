import {
  Coffee, UtensilsCrossed, Moon, Dumbbell, Zap, Wallet,
  Users, Leaf, Timer, Banknote, Soup, Cake, Tag,
} from 'lucide-react'

// Liniowe ikony kategorii (jeden spójny styl) zamiast kolorowych emoji.
// Dopasowanie po slug-u; nierozpoznane kategorie dostają neutralny znacznik.
const MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sniadanie: Coffee,
  obiad: UtensilsCrossed,
  kolacja: Moon,
  fit: Dumbbell,
  szybkie: Zap,
  tanie: Wallet,
  rodzinne: Users,
  wege: Leaf,
  'do-20-minut': Timer,
  'do-30-zl': Banknote,
  zupa: Soup,
  deser: Cake,
}

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = MAP[slug] ?? Tag
  return <Icon className={className} />
}
