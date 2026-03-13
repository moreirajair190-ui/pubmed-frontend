'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type HistoryItem = {
  id: string
  question: string
  normalized_question: string | null
  clinical_summary: string
  article_count: number
  created_at: string
}

export default function HistoryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadHistory() {
      setLoading(true)
      setError('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data, error } = await supabase
        .from('chat_history')
        .select('id, question, normalized_question, clinical_summary, article_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) {
        setError(error.message)
      } else {
        setItems(data || [])
      }

      setLoading(false)
    }

    loadHistory()
  }, [supabase])

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Histórico</h1>
        <p className="mt-3 text-white/60">
          Suas últimas perguntas e respostas clínicas.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Carregando histórico...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Nenhuma pergunta salva ainda.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{item.question}</h2>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
                  {new Date(item.created_at).toLocaleString('pt-BR')}
                </span>
              </div>

              {item.normalized_question && (
                <p className="mb-3 text-sm text-white/60">
                  <span className="font-medium text-white">Pergunta normalizada:</span>{' '}
                  {item.normalized_question}
                </p>
              )}

              <p className="mb-3 text-sm text-white/60">
                <span className="font-medium text-white">Artigos usados:</span>{' '}
                {item.article_count}
              </p>

              <div className="whitespace-pre-wrap leading-7 text-white/80">
                {item.clinical_summary}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
