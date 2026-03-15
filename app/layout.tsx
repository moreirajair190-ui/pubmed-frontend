import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvidenceIA",
  description: "Desmistificando a medicina através da evidência",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#f7f9fd] text-zinc-900 antialiased">
        <div className="min-h-screen">
          <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <a href="/" className="text-2xl font-black tracking-tight text-zinc-900">
                <span className="text-zinc-900">Evidence</span>
                <span className="bg-gradient-to-r from-sky-600 to-indigo-700 bg-clip-text text-transparent">IA</span>
              </a>

              <nav className="flex flex-wrap items-center gap-4 text-sm text-zinc-600">
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
