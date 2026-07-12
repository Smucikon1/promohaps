import { AdminNav } from '@/components/admin/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Ochrona sesji obsługiwana przez src/proxy.ts
  return (
    <div className="min-h-screen bg-stone-50 flex">
      <AdminNav />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
