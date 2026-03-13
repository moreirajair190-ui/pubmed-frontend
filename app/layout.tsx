import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PubMed GPT",
  description: "Assistente clínico baseado em PubMed e IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-black text-white antialiased">
        <div className="min-h-screen">
          <header className="border-b border-white/10 bg-black/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <a href="/" className="text-xl font-bold tracking-tight">
                PubMed GPT
              </a>

              <nav className="flex items-center gap-4 text-sm text-white/80">
                <a href="/" className="hover:text-white">Início</a>
                <a href="/chat" className="hover:text-white">Chat</a>
                <a href="/history" className="hover:text-white">Histórico</a>
                <a href="/login" className="hover:text-white">Login</a>
                <a href="/signup" className="hover:text-white">Criar conta</a>
              </nav>
            </div>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
