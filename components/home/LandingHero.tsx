import Link from 'next/link';

const heroPoints = [
  'Prepare talks before you need them',
  'Choose the voice that fits your delivery',
  'Keep cached talks ready when connectivity drops',
];

const mockSegments = [
  { label: 'Opening', text: 'Thank you for being here today.', status: 'Ready offline' },
  { label: 'Pacing', text: 'Give each sentence space to land clearly.', status: 'Segmented' },
  { label: 'Closing', text: 'End calmly and keep the final message strong.', status: 'Voice previewed' },
];

export function LandingHero() {
  return (
    <section className="px-6 pb-16 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="animate-landing-rise max-w-2xl">
          <span className="inline-flex rounded-full border border-[color:rgba(56,189,248,0.28)] bg-[color:rgba(15,23,42,0.74)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
            Ready when it matters
          </span>

          <h1
            className="mt-6 text-4xl font-semibold leading-tight text-balance sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Reliable speech delivery for non-verbal speakers.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-8 text-[var(--text-secondary)] sm:text-lg">
            Podium helps you import a script, shape the way it is spoken, and keep it ready to present online or from cached talks on the device you rely on.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--primary-hover)]"
            >
              Create an account
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[color:rgba(15,23,42,0.78)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[color:rgba(56,189,248,0.4)] hover:bg-[color:rgba(30,41,59,0.85)]"
            >
              Sign in
            </Link>
          </div>

          <ul className="mt-8 grid gap-3 text-sm text-[var(--foreground)] sm:grid-cols-3 sm:gap-4">
            {heroPoints.map((point, index) => (
              <li
                key={point}
                className="animate-landing-fade rounded-2xl border border-[color:rgba(148,163,184,0.14)] bg-[color:rgba(15,23,42,0.68)] px-4 py-4 shadow-[0_18px_50px_rgba(2,8,23,0.24)]"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-landing-rise lg:justify-self-end" style={{ animationDelay: '120ms' }}>
          <div className="landing-panel relative overflow-hidden rounded-[2rem] border border-[color:rgba(148,163,184,0.18)] bg-[color:rgba(15,23,42,0.82)] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.45)] backdrop-blur">
            <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.6),transparent)]" />

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[color:rgba(148,163,184,0.12)] bg-[color:rgba(30,41,59,0.7)] px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--primary)]">Today&apos;s talk</p>
                <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">School assembly</p>
              </div>
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/12 px-3 py-1 text-xs font-semibold text-emerald-300">
                Cached offline
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[color:rgba(148,163,184,0.12)] bg-[color:rgba(30,41,59,0.58)] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Voice</p>
                <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">ElevenLabs or Azure</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Preview before you present.</p>
              </div>
              <div className="rounded-2xl border border-[color:rgba(148,163,184,0.12)] bg-[color:rgba(30,41,59,0.58)] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Delivery</p>
                <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">Segment by sentence</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Control pacing line by line.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {mockSegments.map((segment, index) => (
                <article
                  key={segment.label}
                  className="animate-landing-fade rounded-2xl border border-[color:rgba(148,163,184,0.12)] bg-[linear-gradient(135deg,rgba(30,41,59,0.8),rgba(15,23,42,0.7))] p-4"
                  style={{ animationDelay: `${180 + index * 120}ms` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{segment.label}</p>
                    <span className="rounded-full bg-[color:rgba(56,189,248,0.14)] px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]">
                      {segment.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{segment.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
