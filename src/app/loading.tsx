// Prosty szkielet podczas ładowania — wypełnia pierwsze 1–2 s przy zimnym starcie
// serwera, żeby użytkownik nie patrzył na pusty ekran.
export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8" role="status" aria-busy="true" aria-label="Wczytuję…">
      <div className="flex items-center gap-4 py-1 md:gap-9 mb-6">
        <div className="h-14 w-14 md:h-24 md:w-24 rounded-2xl bg-stone-100 animate-pulse flex-shrink-0" />
        <div className="w-px self-stretch bg-stone-200 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 rounded-full bg-stone-100 animate-pulse" />
          <div className="h-8 w-3/4 rounded bg-stone-100 animate-pulse" />
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-24 rounded-xl bg-stone-100 animate-pulse flex-shrink-0" />
        ))}
      </div>
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-20 rounded-full bg-stone-100 animate-pulse flex-shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <div className="aspect-[3/2] bg-stone-100 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-3/4 rounded bg-stone-100 animate-pulse" />
              <div className="h-3 w-full rounded bg-stone-100 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-stone-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
