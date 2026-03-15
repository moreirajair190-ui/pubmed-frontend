'use client'

import { createClient } from '@/utils/supabase/client'

export default function SignupPage() {
  const supabase = createClient()

  async function signUpWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/chat`,
      },
    })
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-[#f7f9fd]">
      <div className="mx-auto flex max-w-xl items-center justify-center px-4 py-16">
        <div className="w-full rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-zinc-900">Criar conta na EvidenceIA</h1>
          <p className="mt-2 text-zinc-600">Cadastre-se com sua conta Google.</p>

          <button
            type="button"
            onClick={signUpWithGoogle}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-sky-600 px-5 py-4 font-semibold text-white hover:bg-sky-700"
          >
            Continuar com Google
          </button>
        </div>
      </div>
    </main>
  )
}
