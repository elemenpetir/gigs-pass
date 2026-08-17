export const EVENT_CATEGORIES = [
  { slug: "music", label: "Music" },
  { slug: "festival", label: "Festival" },
  { slug: "concert", label: "Concert" },
  { slug: "comedy", label: "Comedy" },
  { slug: "art", label: "Art" },
  { slug: "culture", label: "Culture" },
];

export function categoryLabel(slug) {
  return EVENT_CATEGORIES.find((c) => c.slug === slug)?.label || slug;
}
