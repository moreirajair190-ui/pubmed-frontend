export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">
        PubMed AI
      </h1>

      <p className="text-lg text-center max-w-xl">
        Inteligência artificial treinada para responder perguntas médicas
        utilizando artigos científicos do PubMed.
      </p>

      <div className="flex gap-4 mt-6">
        <a
          href="/login"
          className="px-6 py-3 bg-black text-white rounded"
        >
          Login
        </a>

        <a
          href="/signup"
          className="px-6 py-3 border rounded"
        >
          Criar conta
        </a>

        <a
          href="/chat"
          className="px-6 py-3 bg-green-600 text-white rounded"
        >
          Abrir Chat Médico
        </a>
      </div>
    </main>
  )
}
