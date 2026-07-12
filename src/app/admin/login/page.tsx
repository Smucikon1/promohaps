import { AdminLoginForm } from '@/components/admin/AdminLoginForm'

export default function AdminLoginPage() {
  // Jeśli user już zalogowany, proxy (src/proxy.ts) przekieruje go do /admin
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">👨‍🍳</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
            Panel admina
          </h1>
          <p className="text-stone-500 text-sm mt-1">Zaloguj się, aby zarządzać przepisami</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  )
}
