'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'

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
  specialty: string | null
  mode: string
  pubmed_query: string
  pubmed_count: number
  answer_text: string
  follow_up_questions: string[]
  source_map: SourceMapItem[]
  web_used: boolean
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  result?: ApiResponse
}

const loadingStages = [
  'Interpretando a pergunta clínica',
  'Consultando a base de conhecimento',
  'Selecionando artigos do PubMed',
  'Refinando a resposta',
]

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
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-sky-100 px-2 text-xs font-bold text-sky-700 hover:bg-sky-200"
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
  const searchParams = useSearchParams()
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  const initialQuestion = searchParams.get('q') || ''
  const initialMode = (searchParams.get('mode') as 'standard' | 'pro') || 'standard'

  const [mode, setMode] = useState<'standard' | 'pro'>(initialMode)
  const [question, setQuestion] = useState(initialQuestion)
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedSource, setSelectedSource] = useState<SourceMapItem | null>(null)
  const [typedAnswer, setTypedAnswer] = useState('')

  const canSubmit = useMemo(() => question.trim().length > 0 && !loading, [question, loading])

  useEffect(() => {
    if (initialQuestion && messages.length === 0) {
      handleSubmit(undefined, initialQuestion, initialMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => {
      setLoadingStage((prev) => (prev + 1) % loadingStages.length)
    }, 1300)
    return () => clearInterval(id)
  }, [loading])

  async function handleSubmit(e?: React.FormEvent, forcedQuestion?: string, forcedMode?: 'standard' | 'pro') {
    if (e) e.preventDefault()

    const currentQuestion = (forcedQuestion ?? question).trim()
    const currentMode = forcedMode ?? mode

    if (!currentQuestion) return

    setLoading(true)
    setLoadingStage(0)
    setError('')
    setTypedAnswer('')

    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const optimisticUser: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: currentQuestion,
    }

    setMessages((prev) => [...prev, optimisticUser])
    setQuestion('')

    try {
      const res = await fetch(`${apiBaseUrl}/clinical-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          mode: currentMode,
          conversation: historyPayload,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Falha ao consultar o backend.')
      }

      const data: ApiResponse = await res.json()

      const assistantId = crypto.randomUUID()
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: data.answer_text,
        result: data,
      }

      setMessages((prev) => [...prev, assistantMessage])

      let i = 0
      const full = data.answer_text
      const timer = setInterval(() => {
        i += 18
        setTypedAnswer(full.slice(0, i))
        if (i >= full.length) clearInterval(timer)
      }, 12)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase.from('chat_history').insert({
          user_id: user.id,
          question: currentQuestion,
          normalized_question: data.normalized_question,
          clinical_summary: data.answer_text,
          pubmed_queries: [data.pubmed_query],
          article_count: data.pubmed_count,
          articles: data.source_map,
        })
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar a resposta.')
    } finally {
      setLoading(false)
    }
  }

  const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant')?.result

  return (
    <main className="min-h-[calc(100vh-73px)] overflow-x-hidden bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f9fd_48%,#f7f9fd_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-r from-sky-500 via-sky-700 to-indigo-800 bg-clip-text text-transparent">
              EvidenceIA
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-lg text-zinc-600 sm:text-xl">
            Pesquisa clínica fundamentada em evidências, indexada por artigos e refinada por IA
          </p>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`rounded-xl px-5 py-3 text-left transition ${
                  mode === 'standard'
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <div className="font-semibold">Standard</div>
                <div className="text-sm opacity-80">Mais rápido e econômico</div>
              </button>

              <button
                type="button"
                onClick={() => setMode('pro')}
                className={`rounded-xl px-5 py-3 text-left transition ${
                  mode === 'pro'
                    ? 'bg-violet-50 text-violet-700'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <div className="font-semibold">Pro</div>
                <div className="text-sm opacity-80">Mais detalhado e robusto</div>
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.55fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-sky-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <form onSubmit={handleSubmit}>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Faça sua pergunta médica..."
                  className="min-h-28 w-full resize-none rounded-3xl border-0 bg-transparent px-3 py-3 text-lg outline-none placeholder:text-zinc-400"
                />

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="text-sm text-zinc-500">
                    {loading ? loadingStages[loadingStage] : 'Pronto para pesquisar'}
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-2xl bg-sky-600 px-5 py-3 font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
                  >
                    {loading ? 'Pesquisando...' : 'Pesquisar'}
                  </button>
                </div>
              </form>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {messages.length === 0 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-zinc-900">Sugestões para começar</h2>
                <div className="grid gap-3">
                  {[
                    'tratamento da cetoacidose diabética',
                    'papel da vitamina b12',
                    'me explique tudo sobre artrite reumatoide',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSubmit(undefined, q)}
                      className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-left text-zinc-800 transition hover:bg-sky-100"
                    >
                      <span>{q}</span>
                      <span className="text-xl">⌕</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, idx) => (
              <section
                key={message.id}
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                {message.role === 'user' ? (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Pergunta
                    </div>
                    <p className="text-lg text-zinc-900">{message.content}</p>
                  </div>
                ) : (
                  <div>
                    {message.result && (
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
                          {message.result.mode === 'standard' ? 'Standard' : 'Pro'}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                          {message.result.pubmed_count} fonte(s) PubMed
                        </span>
                        {message.result.web_used && (
                          <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                            Web como apoio
                          </span>
                        )}
                      </div>
                    )}

                    <CitationText
                      text={idx === messages.length - 1 && !loading && typedAnswer ? typedAnswer : message.content}
                      onCitationClick={(index) => {
                        const source = message.result?.source_map?.find((s) => s.index === index) || null
                        setSelectedSource(source)
                      }}
                    />

                    {message.result?.follow_up_questions?.length ? (
                      <div className="mt-6">
                        <div className="mb-3 text-sm font-semibold text-zinc-900">Perguntas sugeridas</div>
                        <div className="grid gap-3">
                          {message.result.follow_up_questions.map((q, i) => (
                            <button
                              key={`${q}-${i}`}
                              type="button"
                              onClick={() => handleSubmit(undefined, q)}
                              className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-left text-zinc-800 transition hover:bg-sky-100"
                            >
                              <span>{q}</span>
                              <span className="text-xl">⌕</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            ))}

            {loading && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-3 text-sm font-semibold text-zinc-900">Gerando resposta</div>
                <div className="space-y-3">
                  {loadingStages.map((step, i) => (
                    <div
                      key={step}
                      className={`rounded-2xl px-4 py-3 text-sm transition ${
                        i === loadingStage
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-zinc-50 text-zinc-500'
                      }`}
                    >
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.length > 0 && (
              <div className="sticky bottom-3">
                <div className="rounded-[28px] border-2 border-sky-200 bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
                  <form onSubmit={handleSubmit} className="flex items-center gap-3">
                    <input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Faça uma pergunta de acompanhamento"
                      className="h-14 min-w-0 flex-1 rounded-2xl border-0 bg-transparent px-4 text-base outline-none placeholder:text-zinc-400"
                    />

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
                      {mode === 'standard' ? 'Standard' : 'Pro'}
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white transition hover:bg-sky-700 disabled:opacity-50"
                    >
                      ↗
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Fontes PubMed</h2>

              {!latestAssistant?.source_map?.length ? (
                <p className="text-sm text-zinc-500">As fontes PubMed aparecerão aqui após a resposta.</p>
              ) : (
                <div className="space-y-3">
                  {latestAssistant.source_map.map((source) => (
                    <button
                      key={source.index}
                      type="button"
                      onClick={() => setSelectedSource(source)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:bg-zinc-50"
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
                        {source.journal || 'PubMed'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-zinc-900">{selectedSource.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                  {selectedSource.pmid ? <span>PMID {selectedSource.pmid}</span> : null}
                  {selectedSource.year ? <span>{selectedSource.year}</span> : null}
                  {selectedSource.journal ? <span>{selectedSource.journal}</span> : null}
                  {selectedSource.study_type ? <span>{selectedSource.study_type}</span> : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
              >
                Fechar
              </button>
            </div>

            <div className="rounded-2xl bg-violet-50 p-4">
              <div className="mb-2 text-sm font-semibold text-violet-700">Resumo da fonte</div>
              <p className="leading-7 text-zinc-800">
                {selectedSource.abstract || 'Sem resumo disponível.'}
              </p>
            </div>

            {selectedSource.url && (
              <div className="mt-5">
                <a
                  href={selectedSource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-700"
                >
                  Abrir no PubMed
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
