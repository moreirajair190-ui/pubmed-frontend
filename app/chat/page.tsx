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

type ApiResponse = {
  question: string
  normalized_question: string
  keywords: string[]
  pubmed_queries: string[]
  count: number
  clinical_summary: string
  articles: Article[]
}

function studyBadge(studyType: string) {
  const normalized = studyType.toLowerCase()

  if (normalized.includes('meta-analysis')) return 'Meta-analysis'
  if (normalized.includes('systematic review')) return 'Systematic review'
  if (normalized.includes('randomized controlled trial')) return 'RCT'
  if (normalized.includes('clinical trial')) return 'Clinical trial'
  if (normalized.includes('cohort')) return 'Cohort'
  if (normalized.includes('case-control')) return 'Case-control'
  if (normalized.includes('cross-sectional')) return 'Cross-sectional'
  if (normalized.includes('case')) return 'Case report'
  return studyType || 'Unspecified'
}

export default function ChatPage() {
  const supabase = createClient()

  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [expandedPmids, setExpandedPmids] = useState<Record<string, boolean>>({})

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  const canSubmit = useMemo(() => question.trim().length > 0 && !loading, [question, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setStage('Interpretando a pergunta...')
    setError('')
    setResult(null)

    try {
      setStage('Buscando artigos no PubMed...')
      const res = await fetch(
        `${apiBaseUrl}/clinical-answer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            max_results: 5,
          }),
        }
      )

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Falha ao consultar o backend.')
      }

      setStage('Gerando resposta clínica...')
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
          clinical_summary: data.clinical_summary,
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

  function toggleAbstract(pmid: string) {
    setExpandedPmids((prev) => ({
      ...prev,
      [pmid]: !prev[pmid],
    }))
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
          Chat clínico baseado em evidências
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Chat PubMed</h1>
        <p className="mt-3 max-w-3xl text-white/60">
          Faça uma pergunta médica. O sistema interpreta a pergunta, gera estratégias de busca,
          consulta o PubMed e devolve uma resposta clínica baseada nos artigos encontrados.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
        <label className="mb-3 block text-sm font-medium text-white/80">
          Pergunta clínica
        </label>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex.: Qual o papel dos inibidores de SGLT2 em pacientes com diabetes tipo 2 em uso de insulina?"
          className="min-h-40 w-full rounded-xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-white/30"
          required
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-white px-5 py-3 font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Buscar resposta clínica'}
          </button>

          {loading && (
            <span className="text-sm text-white/60">
              {stage}
            </span>
          )}
        </div>
      </form>

      {error && (
        <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="grid gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-2xl font-semibold">Resposta clínica</h2>
            <div className="whitespace-pre-wrap leading-8 text-white/90">
              {result.clinical_summary}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">Pergunta interpretada</h2>
              <div className="space-y-3 text-white/80">
                <p>
                  <span className="font-semibold text-white">Pergunta original:</span>{' '}
                  {result.question}
                </p>
                <p>
                  <span className="font-semibold text-white">Pergunta normalizada:</span>{' '}
                  {result.normalized_question}
                </p>
                <p>
                  <span className="font-semibold text-white">Artigos retornados:</span>{' '}
                  {result.count}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">Palavras-chave</h2>
              {result.keywords && result.keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((keyword, index) => (
                    <span
                      key={`${keyword}-${index}`}
                      className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-white/60">Nenhuma palavra-chave retornada.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-xl font-semibold">Estratégias de busca PubMed</h2>
            {result.pubmed_queries && result.pubmed_queries.length > 0 ? (
              <div className="grid gap-3">
                {result.pubmed_queries.map((query, index) => (
                  <div
                    key={`${query}-${index}`}
                    className="rounded-xl border border-white/10 bg-black/30 p-4"
                  >
                    <p className="mb-2 text-xs uppercase tracking-wide text-white/40">
                      Query {index + 1}
                    </p>
                    <p className="break-words text-sm leading-7 text-white/80">
                      {query}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/60">Nenhuma query foi exibida.</p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Artigos utilizados</h2>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60">
                {result.articles.length} artigo(s)
              </span>
            </div>

            {result.articles.length === 0 ? (
              <p className="text-white/60">Nenhum artigo foi retornado para esta pergunta.</p>
            ) : (
              <div className="grid gap-4">
                {result.articles.map((article) => {
                  const expanded = !!expandedPmids[article.pmid]
                  const abstractText = article.abstract || 'Sem abstract disponível.'
                  const preview =
                    abstractText.length > 420 && !expanded
                      ? `${abstractText.slice(0, 420)}...`
                      : abstractText

                  return (
                    <article
                      key={article.pmid}
                      className="rounded-2xl border border-white/10 bg-black/30 p-5"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{article.title}</h3>
                          <p className="mt-1 text-sm text-white/50">
                            {article.journal || 'Journal não informado'} • {article.year || 'Ano não informado'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                            {studyBadge(article.study_type)}
                          </span>

                          {typeof article.final_score === 'number' && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                              Score {article.final_score}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mb-4 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
                        <p><span className="font-medium text-white">PMID:</span> {article.pmid}</p>
                        <p><span className="font-medium text-white">Evidência:</span> {article.evidence_score}</p>
                      </div>

                      <p className="leading-7 text-white/80">{preview}</p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {article.abstract && article.abstract.length > 420 && (
                          <button
                            type="button"
                            onClick={() => toggleAbstract(article.pmid)}
                            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5"
                          >
                            {expanded ? 'Mostrar menos' : 'Ler mais'}
                          </button>
                        )}

                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:opacity-90"
                          >
                            Ver no PubMed
                          </a>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
