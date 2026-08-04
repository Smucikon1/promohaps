// Szkielet strony przepisu — pokazywany podczas zimnego SSR-a z Supabase.
export default function RecipeLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6" role="status" aria-busy="true" aria-label="Wczytuję przepis…">
      <div className="h-12 rounded-2xl bg-stone-100 animate-pulse mb-6" />
      <div className="aspect-[16/10] sm:aspect-[16/8] rounded-3xl bg-stone-100 animate-pulse mb-6" />
      <div className="space-y-3 mb-8">
        <div className="h-8 w-3/4 rounded bg-stone-100 animate-pulse" />
        <div className="h-4 w-full rounded bg-stone-100 animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-stone-100 animate-pulse" />
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 h-64 rounded-2xl bg-stone-100 animate-pulse" />
        <div className="md:col-span-2 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
