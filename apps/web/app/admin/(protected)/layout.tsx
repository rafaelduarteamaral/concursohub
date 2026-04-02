import Link from 'next/link';
import { BookOpen, LayoutDashboard, List, Database, LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2 font-bold text-primary">
            <BookOpen className="h-5 w-5" />
            <span>ConcursoHub</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Painel Admin</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/admin/fila"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <List className="h-4 w-4" />
            Fila de Revisão
          </Link>
          <Link
            href="/admin/fontes"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Database className="h-4 w-4" />
            Fontes
          </Link>
        </nav>

        <div className="p-3 border-t border-border">
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
