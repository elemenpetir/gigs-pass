export default function PlaceholderPage({ title }) {
  return (
    <section className="py-8">
      <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4">
        {title} <span className="text-gigs-pink">✸</span>
      </h1>
      <div className="border-4 border-foreground bg-canvas p-12 text-center">
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">
          Under Construction
        </h2>
        <p className="font-bold">This section is being wired up. Check back soon.</p>
      </div>
    </section>
  );
}