import Link from 'next/link';
import { LandingHero } from './LandingHero';
import { LandingHowItWorks } from './LandingHowItWorks';
import { LandingFeatures } from './LandingFeatures';
import { LandingFinalCta } from './LandingFinalCta';

export function LandingPage() {
  return (
    <div className="relative overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div aria-hidden className="landing-grid absolute inset-0 opacity-40" />
      <div aria-hidden className="landing-orb landing-orb-primary" />
      <div aria-hidden className="landing-orb landing-orb-secondary" />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-[var(--foreground)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Podium
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full border border-[color:rgba(56,189,248,0.4)] bg-[color:rgba(56,189,248,0.16)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[color:rgba(56,189,248,0.65)] hover:bg-[color:rgba(56,189,248,0.24)]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <LandingHero />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingFinalCta />
      </main>
    </div>
  );
}
