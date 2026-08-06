'use client'

import { SITE_URL } from '@/lib/site'

interface Props {
  url: string
  imageUrl?: string | null
  description: string
  variant?: 'overlay' | 'inline'
}

// „Pin it" — otwiera oficjalny Pinterest Rich Pin creator w nowym oknie.
// Nie wymaga skryptu ani konta Pinterest po naszej stronie.
export function PinterestSaveButton({ url, imageUrl, description, variant = 'overlay' }: Props) {
  if (!imageUrl) return null

  const absoluteUrl = url.startsWith('http') ? url : `${SITE_URL}${url}`
  const absoluteImg = imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`
  const pinUrl =
    `https://www.pinterest.com/pin/create/button/` +
    `?url=${encodeURIComponent(absoluteUrl)}` +
    `&media=${encodeURIComponent(absoluteImg)}` +
    `&description=${encodeURIComponent(description)}`

  const openPin = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.open(pinUrl, 'pinterest', 'width=750,height=560,resizable=yes,scrollbars=yes')
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={openPin}
        aria-label="Zapisz na Pinterest"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border bg-white text-stone-600 border-stone-200 hover:border-[#e60023] hover:text-[#e60023] transition-colors"
      >
        <PinterestIcon className="w-4 h-4" />
        Pin it
      </button>
    )
  }

  return (
    <button
      onClick={openPin}
      aria-label="Zapisz na Pinterest"
      className="w-8 h-8 rounded-full bg-white/90 hover:bg-[#e60023] shadow-sm flex items-center justify-center transition-colors group"
    >
      <PinterestIcon className="w-4 h-4 text-stone-500 group-hover:text-white" />
    </button>
  )
}

// Oficjalne logo Pinterest jako inline SVG (bez zewnętrznych zależności)
function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </svg>
  )
}
