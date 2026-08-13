export default function Home() {
  return (
    <section className="py-16">
      <h1 className="text-display-hero font-black uppercase tracking-tighter leading-[0.82]">
        FIND YOUR<br />
        <span className="bg-foreground text-background px-4 brut-shadow inline-block mt-2 ml-10">NEXT GIG.</span>
      </h1>
      <p className="text-xl font-bold mt-8 max-w-md">
        Concerts, festivals, and unforgettable moments. Your next story starts here.{" "}
        <span className="inline-block text-gigs-pink text-2xl animate-pulse">✸</span>
      </p>
    </section>
  );
}