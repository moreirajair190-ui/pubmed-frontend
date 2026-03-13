'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Article = {
  pmid: string
  title: string
  year: string
  journal: string
  study_type: string
  evidence_score: number
  abstract: string
  url: string
  final_score?: number
}

type SourceMapItem = {
  index: number
  pmid: string
  title: string
  year: string
  journal: string
  study_type: string
  abstract: string
  url: string
}

type ApiResponse = {
  question: string
  normalized_question: string
  keywords: string[]
  pubmed_queries: string[]
  count: number
  clinical_summary: string
  answer_text: string
  follow_up_questions: string[]
  source_map: SourceMapItem[]
  articles: Article[]
}

function CitationText({
  text,
  onCitationClick,
}: {
  text: string
  onCitationClick: (index: number) => void
}) {
  const parts = text.split(/(\[\d+\](?:\[\d+\])*)/g)

  return (
    <div className="whitespace-pre-wrap leading-8 text-[17px] text-zinc-800">
      {parts.map((part, idx) => {
        const match = part.match(/^(\[\d+\](?:\[\d+\])*)$/)
        if (!match) return <span key={idx}>{part}</span>

        const nums = [...part.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))

        return (
          <span key={idx} className="inline-flex gap-1 align-middle">
            {nums.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onCitationClick(n)}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-sky-100 px-2 text-xs font-semibold text-sky-700 hover:bg-sky-200"
              >
                {n}
              </button>
            ))}
          </span>
        )
      })}
    </div>
  )
}

export default function ChatPage() {
  const supabase = createClient()

  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [selectedCitation, setSelectedCitation] = useState<number | null>(null)

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  const canSubmit = useMemo(() => question.trim().length > 0 && !loading, [question, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setStage('Interpretando a pergunta...')
    setError('')
    setResult(null)
    setSelectedCitation(null)

    try {
      setStage('Buscando artigos...')
      const res = await fetch(`${apiBaseUrl}/clinical-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, max_results: 5 }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Falha ao consultar o backend.')
      }

      setStage('Gerando resposta...')
      const data: ApiResponse = await res.json()
      setResult(data)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase.from('chat_history').insert({
          user_id: user.id,
          question,
          normalized_question: data.normalized_question,
          clinical_summary: data.answer_text || data.clinical_summary,
          pubmed_queries: data.pubmed_queries,
          article_count: data.count,
          articles: data.articles,
        })
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar a resposta clínica.')
    } finally {
      setLoading(false)
      setStage('')
    }
  }

  const highlightedSource = result?.source_map?.find((s) => s.index === selectedCitation)

  return (
    <main className="min-h-[calc(100vh-73px)] bg-[#f7f9fc]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">PubMed Chat</h1>
          <p className="mt-3 max-w-3xl text-zinc-600">
            Faça uma pergunta médica e receba uma resposta baseada em artigos científicos,
            com citações no meio do texto e fontes organizadas logo abaixo.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-6">
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm"
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ex.: me explique a fisiopatologia da doença de Alzheimer"
                className="min-h-32 w-full resize-none rounded-2xl border border-transparent bg-transparent p-2 text-lg text-zinc-900 outline-none placeholder:text-zinc-400"
                required
              />

              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="text-sm text-zinc-500">
                  {loading ? stage : 'Pergunte em português ou inglês'}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-2xl bg-sky-600 px-5 py-3 font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Buscando...' : 'Pesquisar'}
                </button>
              </div>
            </form>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {result && (
              <>
                <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
                      Resposta baseada em {result.count} artigo(s)
                    </span>
                    {result.normalized_question && (
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-sm text-sky-700">
                        Pergunta interpretada
                      </span>
                    )}
                  </div>

                  <CitationText
                    text={result.answer_text || result.clinical_summary}
                    onCitationClick={(index) => setSelectedCitation(index)}
                  />
                </section>

                {result.follow_up_questions?.length > 0 && (
                  <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-zinc-900">Perguntas sugeridas</h2>

                    <div className="grid gap-3">
                      {result.follow_up_questions.map((q, idx) => (
                        <button
                          key={`${q}-${idx}`}
                          type="button"
                          onClick={() => setQuestion(q)}
                          className="rounded-2xl bg-sky-50 px-4 py-3 text-left text-zinc-800 transition hover:bg-sky-100"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-zinc-900">Como a pergunta foi interpretada</h2>

                  <div className="space-y-4 text-sm text-zinc-700">
                    <div>
                      <p className="font-semibold text-zinc-900">Pergunta original</p>
                      <p>{result.question}</p>
                    </div>

                    <div>
                      <p className="font-semibold text-zinc-900">Pergunta normalizada</p>
                      <p>{result.normalized_question}</p>
                    </div>

                    <div>
                      <p className="mb-2 font-semibold text-zinc-900">Palavras-chave</p>
                      <div className="flex flex-wrap gap-2">
                        {result.keywords?.map((k, idx) => (
                          <span
                            key={`${k}-${idx}`}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 font-semibold text-zinc-900">Queries usadas no PubMed</p>
                      <div className="grid gap-2">
                        {result.pubmed_queries?.map((q, idx) => (
                          <div key={`${q}-${idx}`} className="rounded-xl bg-zinc-50 p-3 text-zinc-700">
                            <span className="mr-2 font-semibold text-zinc-500">[{idx + 1}]</span>
                            {q}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Fontes</h2>

              {!result || !result.source_map || result.source_map.length === 0 ? (
                <p className="text-sm text-zinc-500">As fontes aparecerão aqui depois da resposta.</p>
              ) : (
                <div className="space-y-3">
                  {result.source_map.map((source) => {
                    const active = selectedCitation === source.index
                    return (
                      <button
                        key={source.index}
                        type="button"
                        onClick={() => setSelectedCitation(source.index)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          active
                            ? 'border-sky-300 bg-sky-50'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50'
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-sky-100 px-2 text-xs font-semibold text-sky-700">
                            {source.index}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {source.year || 's/ano'}
                          </span>
                        </div>

                        <p className="line-clamp-2 font-medium text-zinc-900">
                          {source.title}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {source.journal || 'Journal não informado'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {highlightedSource && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-lg font-semibold text-zinc-900">
                  Fonte [{highlightedSource.index}]
                </h3>

                <div className="space-y-3 text-sm text-zinc-700">
                  <p><span className="font-semibold text-zinc-900">Título:</span> {highlightedSource.title}</p>
                  <p><span className="font-semibold text-zinc-900">PMID:</span> {highlightedSource.pmid}</p>
                  <p><span className="font-semibold text-zinc-900">Ano:</span> {highlightedSource.year || 'N/A'}</p>
                  <p><span className="font-semibold text-zinc-900">Journal:</span> {highlightedSource.journal || 'N/A'}</p>
                  <p><span className="font-semibold text-zinc-900">Tipo:</span> {highlightedSource.study_type || 'N/A'}</p>

                  <p className="leading-7">
                    <span className="font-semibold text-zinc-900">Abstract:</span>{' '}
                    {highlightedSource.abstract || 'Sem abstract disponível.'}
                  </p>

                  {highlightedSource.url && (
                    <a
                      href={highlightedSource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
                    >
                      Abrir no PubMed
                    </a>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
