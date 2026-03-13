'use client'

import { useState } from 'react'

type Article = {
  pmid: string
  title: string
  year: string
  journal: string
  study_type: string
  evidence_score: number
  abstract: string
  url: string
}

type ApiResponse = {
  question: string
  pubmed_query: string
  count: number
  clinical_summary: string
  articles: Article[]
}

export default function ChatPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ApiResponse | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(
       
	'https://gpt-pubmed-backend.onrender.com/clinical-answer',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            max_results: 10,
          }),
        }
      )

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Falha ao consultar o backend.')
      }

      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar a resposta clínica.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Chat PubMed</h1>
      <p className="text-gray-600 mb-6">
        Faça uma pergunta médica e o sistema buscará artigos no PubMed e gerará uma resposta clínica.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex.: tratamento do diabetes tipo 2"
          className="w-full min-h-32 rounded border p-4"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded bg-black text-white"
        >
          {loading ? 'Analisando artigos...' : 'Buscar resposta clínica'}
        </button>
      </form>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <section className="rounded border p-4">
            <h2 className="text-xl font-semibold mb-3">Resumo da busca</h2>
            <p><strong>Pergunta:</strong> {result.question}</p>
            <p><strong>Query PubMed:</strong> {result.pubmed_query}</p>
            <p><strong>Artigos encontrados:</strong> {result.count}</p>
          </section>

<section className="rounded border p-4">
            <h2 className="text-xl font-semibold mb-3">Resposta clínica</h2>
            <div className="whitespace-pre-wrap leading-7">
              {result.clinical_summary}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Artigos utilizados</h2>

            {result.articles.map((article) => (
              <article key={article.pmid} className="rounded border p-4 space-y-2">
                <h3 className="text-lg font-semibold">{article.title}</h3>

                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>PMID:</strong> {article.pmid}</p>
                  <p><strong>Ano:</strong> {article.year || 'N/A'}</p>
                  <p><strong>Journal:</strong> {article.journal || 'N/A'}</p>
                  <p><strong>Tipo de estudo:</strong> {article.study_type}</p>
                  <p><strong>Score de evidência:</strong> {article.evidence_score}</p>
                </div>

                <p className="text-sm leading-6">
                  {article.abstract || 'Sem abstract disponível.'}
                </p>

                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-blue-600 underline"
                  >
                    Ver no PubMed
                  </a>
                )}
              </article>
            ))}
          </section>
        </div>
      )}
    </main>
  )
}
