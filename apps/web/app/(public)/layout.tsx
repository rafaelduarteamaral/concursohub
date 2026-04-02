import Link from 'next/link';
import { SearchBar } from '@/components/search-bar';
import { ThemeToggle } from '@/components/theme-toggle';
import { CookieBanner } from '@/components/cookie-banner';
import { BookOpen } from 'lucide-react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 transition-colors duration-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl text-primary shrink-0"
          >
            <BookOpen className="h-5 w-5" />
            <span>ConcursoHub</span>
          </Link>

          <div className="flex-1 max-w-md">
            <SearchBar />
          </div>

          <nav className="hidden md:flex items-center gap-4 text-sm shrink-0">
            <Link
              href="/?status=inscricoes_abertas"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Concursos
            </Link>
            <Link
              href="/estado/sp"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Estados
            </Link>
            <Link
              href="/area/tecnologia-da-informacao"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Áreas
            </Link>
            <Link
              href="/?banca=CESPE"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Bancas
            </Link>
            <ThemeToggle />
          </nav>

          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-background py-10 mt-12 transition-colors duration-200">
        <div className="container mx-auto px-4 text-sm text-muted-foreground">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">ConcursoHub</span>
              </div>
              <p className="text-xs leading-relaxed">
                Portal de concursos públicos brasileiros. Acompanhe inscrições abertas, editais e
                datas de provas em todo o Brasil.
              </p>
            </div>

            <div className="flex gap-12">
              <div>
                <p className="font-medium text-foreground mb-3">Concursos</p>
                <ul className="space-y-2">
                  <li>
                    <Link href="/?status=inscricoes_abertas" className="hover:text-foreground transition-colors">
                      Inscrições Abertas
                    </Link>
                  </li>
                  <li>
                    <Link href="/?esfera=federal" className="hover:text-foreground transition-colors">
                      Federais
                    </Link>
                  </li>
                  <li>
                    <Link href="/?esfera=estadual" className="hover:text-foreground transition-colors">
                      Estaduais
                    </Link>
                  </li>
                  <li>
                    <Link href="/busca" className="hover:text-foreground transition-colors">
                      Buscar
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-3">Institucional</p>
                <ul className="space-y-2">
                  <li>
                    <Link href="/sobre" className="hover:text-foreground transition-colors">
                      Sobre
                    </Link>
                  </li>
                  <li>
                    <Link href="/contato" className="hover:text-foreground transition-colors">
                      Contato
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacidade" className="hover:text-foreground transition-colors">
                      Privacidade
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <p>© {new Date().getFullYear()} ConcursoHub. Todos os direitos reservados.</p>
            <p>Informações coletadas de fontes públicas oficiais.</p>
          </div>
        </div>
      </footer>

      <CookieBanner />
    </div>
  );
}
