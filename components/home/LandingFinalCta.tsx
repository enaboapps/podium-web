import Link from 'next/link';

export function LandingFinalCta() {
  return (
    <section className="px-6 pb-20 pt-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-[color:rgba(148,163,184,0.14)] bg-[linear-gradient(135deg,rgba(8,47,73,0.9),rgba(15,23,42,0.96))] px-6 py-10 shadow-[0_28px_90px_rgba(2,8,23,0.28)] sm:px-8 sm:py-12">
          <div aria-hidden className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.16),transparent_70%)]" />

          <div className="relative flex max-w-3xl flex-col gap-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">Final check</p>
            <h2
              className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Set up the talk before you need it, then open Podium and present.
            </h2>
            <p className="max-w-2xl text-base leading-8 text-slate-200/84">
              Create an account to start building your library, or sign in to continue preparing the talks you already rely on.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Create an account
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/8 px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/14"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
