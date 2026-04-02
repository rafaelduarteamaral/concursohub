import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'ConcursoHub — Concursos Públicos do Brasil',
    template: '%s | ConcursoHub',
  },
  description:
    'Portal completo de concursos públicos brasileiros. Encontre concursos abertos, inscrições, editais e datas de provas em um só lugar.',
  keywords: ['concursos públicos', 'concursos abertos', 'editais', 'concurso federal', 'concurso estadual', 'inscricoes'],
  authors: [{ name: 'ConcursoHub' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'ConcursoHub',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
