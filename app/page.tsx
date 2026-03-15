'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<'standard' | 'pro'>('standard')

  function goToChat(forcedQuestion?: string) {
    const q = (forcedQuestion ?? question).trim()
    if (!q) return
    router.push(`/chat?q=${encodeURIComponent(q)}&mode=${mode}`)
  }

  const comuns = [
    'Qual o papel da vitamina B12 no organismo?',
    'Como confirmar artrite reumatoide?',
    'Tratamento da cetoacidose diabética',
  ]

  const complexas = [
    'A vacina contra COVID pode piorar artrite?',
    'Qual a fisiopatologia da doença de Alzheimer?',
    'Quais exames devo pedir para diferenciar anemia ferropriva e megaloblástica?',
  ]

  return (
    <main className="min-h-[calc(100vh-73px)] bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f9fd_45%,#f7f9fd_100%)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
            <span className="bg-gradient-to-r from-sky-500 via-sky-700 to-indigo-800 bg-clip-text text-transparent">
              EvidenceIA
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-3xl text-xl text-zinc-600 sm:text-2xl">
            Desmistificando a medicina através da evidência
          </p>
        </div>

        <div className="mt-8 w-full max-w-4xl rounded-[32px] border border-sky-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Faça uma pergunta médica..."
            className="min-h-28 w-full resize-none rounded-3xl border-0 bg-transparent px-3 py-3 text-lg outline-none placeholder:text-zinc-400"
          />

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  mode === 'standard'
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Standard
              </button>

              <button
                type="button"
                onClick={() => setMode('pro')}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  mode === 'pro'
                    ? 'bg-violet-50 text-violet-700'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Pro
              </button>
            </div>

            <button
              type="button"
              onClick={() => goToChat()}
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-sky-600 px-6 text-base font-semibold text-white transition hover:bg-sky-700"
            >
              Pesquisar
            </button>
          </div>
        </div>

        <div className="mt-10 w-full max-w-4xl space-y-8">
          <section>
            <div className="mb-3 flex items-center gap-2 text-zinc-700">
              <span>💡</span>
              <h2 className="text-lg font-semibold">Comece com perguntas comuns</h2>
            </div>

            <div className="grid gap-3">
              {comuns.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToChat(item)}
                  className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-left text-zinc-800 transition hover:bg-sky-100"
                >
                  <span>{item}</span>
                  <span className="text-xl">⌕</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-zinc-700">
              <span>🎓</span>
              <h2 className="text-lg font-semibold">Aprofunde-se em perguntas complexas</h2>
            </div>

            <div className="grid gap-3">
              {complexas.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToChat(item)}
                  className="flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50 px-5 py-4 text-left text-zinc-800 transition hover:bg-violet-100"
                >
                  <span>{item}</span>
                  <span className="text-xl">⌕</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
