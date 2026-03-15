import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvidenceAI",
  description: "Estudo médico avançado com RAG, PubMed e IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#f6f8fc] text-zinc-900 antialiased">
        <div className="min-h-screen">
          <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <a href="/" className="text-xl font-bold tracking-tight text-zinc-900">
                EvidenceAI
              </a>

              <nav className="flex items-center gap-5 text-sm text-zinc-600">
                <a href="/" className="hover:text-zinc-900">Início</a>
                <a href="/chat" className="hover:text-zinc-900">Chat</a>
                <a href="/history" className="hover:text-zinc-900">Histórico</a>
                <a href="/login" className="hover:text-zinc-900">Login</a>
                <a href="/signup" className="hover:text-zinc-900">Criar conta</a>
              </nav>
            </div>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
