'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COOKIE_KEY = 'concursohub_cookie_consent';

export type CookieConsent = 'accepted' | 'declined' | null;

export function getCookieConsent(): CookieConsent {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(COOKIE_KEY) as CookieConsent) ?? null;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) setVisible(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    setVisible(false);
    window.dispatchEvent(new Event('cookie-consent-accepted'));
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-background border border-border rounded-xl shadow-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground font-medium mb-1">
              Usamos cookies para melhorar sua experiência
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Este site usa cookies essenciais e, com seu consentimento, cookies de publicidade
              (Google AdSense). Veja nossa{' '}
              <Link href="/privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleDecline} className="flex-1 sm:flex-none text-xs">
            Recusar
          </Button>
          <Button size="sm" onClick={handleAccept} className="flex-1 sm:flex-none text-xs">
            Aceitar todos
          </Button>
          <button
            onClick={handleDecline}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
