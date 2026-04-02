'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError('Email ou senha incorretos.');
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError('Erro ao tentar autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required
          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block" htmlFor="password">Senha</label>
        <input id="password" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} required
          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Entrando...</> : 'Entrar'}
      </Button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">ConcursoHub Admin</span>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold mb-6 text-center">Acesso Administrativo</h1>
          <Suspense fallback={<div className="h-40 animate-pulse bg-muted rounded" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
