const steps = [
  {
    number: '01',
    title: 'Import your script',
    description: 'Bring in a Word document or PDF, then turn it into a talk without rebuilding everything by hand.',
  },
  {
    number: '02',
    title: 'Prepare the delivery',
    description: 'Break the talk into segments, adjust pacing, and choose the voice setup that fits how you want it to sound.',
  },
  {
    number: '03',
    title: 'Present with confidence',
    description: 'Open the talk when you need it and rely on cached content on the device you prepared in advance.',
  },
];

export function LandingHowItWorks() {
  return (
    <section className="px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">How it works</p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Prepare once, then keep the talk ready.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.number}
              className="animate-landing-fade rounded-[1.75rem] border border-[color:rgba(148,163,184,0.12)] bg-[color:rgba(15,23,42,0.72)] p-6 shadow-[0_20px_60px_rgba(2,8,23,0.18)]"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <p className="text-sm font-semibold tracking-[0.24em] text-[var(--primary)]">{step.number}</p>
              <h3 className="mt-6 text-xl font-semibold text-[var(--foreground)]">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
