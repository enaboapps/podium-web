const features = [
  {
    title: 'Import Word and PDF scripts',
    description: 'Start from the document you already have instead of retyping a speech into the app.',
  },
  {
    title: 'Tune delivery with segments',
    description: 'Break long text into manageable parts so each line lands at a steadier pace.',
  },
  {
    title: 'Choose and preview a voice',
    description: 'Switch between supported providers and confirm the voice before you rely on it.',
  },
  {
    title: 'Keep talks offline and grouped into sets',
    description: 'Prepare talks on the device ahead of time and organise them for recurring events.',
  },
];

export function LandingFeatures() {
  return (
    <section className="px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Core features</p>
          <h2
            className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Built for real preparation, not just a text box.
          </h2>
          <p className="text-base leading-8 text-[var(--text-secondary)]">
            Podium focuses on the steps that matter before a presentation: getting the script in, shaping the voice, and keeping the final talk available.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="animate-landing-fade rounded-[1.75rem] border border-[color:rgba(148,163,184,0.12)] bg-[linear-gradient(145deg,rgba(30,41,59,0.82),rgba(15,23,42,0.72))] p-6 shadow-[0_22px_70px_rgba(2,8,23,0.2)]"
              style={{ animationDelay: `${index * 110}ms` }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:rgba(56,189,248,0.22)] bg-[color:rgba(56,189,248,0.14)] text-sm font-semibold text-[var(--primary)]">
                0{index + 1}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-[var(--foreground)]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
