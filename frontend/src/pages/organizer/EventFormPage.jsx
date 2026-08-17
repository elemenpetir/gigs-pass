import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ImagePlus } from "lucide-react";
import { api } from "@/lib/api";
import { Input, Textarea, Select, Label } from "@/components";
import { EVENT_CATEGORIES } from "@/lib/categories";

function toDatetimeLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [existingImage, setExistingImage] = useState("");
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get(`/events/${id}`);
        if (cancelled) return;
        setTitle(data.event.title || "");
        setDescription(data.event.description || "");
        setCategory(data.event.category || "");
        setEventDate(toDatetimeLocal(data.event.event_date));
        setExistingImage(data.event.image_url || "");
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load event");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editing, id]);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(f);
    } else {
      setPreview("");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let eventId = id;
      if (editing) {
        await api.put(`/events/${id}`, {
          title,
          description,
          category,
          event_date: eventDate,
        });
      } else {
        const data = await api.post("/events", {
          title,
          description,
          category,
          event_date: eventDate,
        });
        eventId = data.event.id;
      }
      if (file) {
        const formData = new FormData();
        formData.append("image", file);
        await api.upload(`/events/${eventId}/image`, formData);
      }
      navigate("/organizer/events");
    } catch (err) {
      setError(err.message || "Failed to save event");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="py-20 flex justify-center">
        <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
      </section>
    );
  }

  return (
    <section className="py-4">
      <nav className="mb-8 font-bold uppercase text-sm">
        <Link to="/organizer/events" className="hover:text-gigs-pink transition-colors">
          ← MY EVENTS
        </Link>
      </nav>

      <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 flex items-center gap-4">
        {editing ? (
          <>
            EDIT <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">EVENT</span>
          </>
        ) : (
          <>
            NEW <span className="bg-gigs-pink px-2 brut-shadow -rotate-2 inline-block">EVENT</span>
          </>
        )}
      </h1>
      <p className="font-bold text-lg mb-10">Set the stage. Pick a date. Make noise.</p>

      <form onSubmit={submit} className="border-4 border-foreground bg-canvas p-6 md:p-10 brut-shadow max-w-3xl space-y-6">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Neon Nights Festival" />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="" disabled>Pick a vibe</option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes this gig unforgettable?" />
        </div>

        <div>
          <Label htmlFor="event-date">Event Date</Label>
          <Input id="event-date" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        </div>

        <div>
          <Label>Poster Image</Label>
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="aspect-4/3 w-full md:w-56 brut-border-2 bg-gigs-dark overflow-hidden flex items-center justify-center">
              {preview || existingImage ? (
                <img src={preview || existingImage} alt="Poster preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-background/70 font-black uppercase text-center px-4">no poster yet</span>
              )}
            </div>
            <div className="flex-1">
              <label className="inline-flex items-center gap-2 bg-gigs-yellow text-ink px-5 py-3 font-black uppercase text-sm brut-border-2 brut-button cursor-pointer">
                <ImagePlus size={18} strokeWidth={3} />
                {preview || existingImage ? "Replace Image" : "Choose Image"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileChange} className="hidden" />
              </label>
              <p className="text-sm font-bold text-foreground/60 mt-2">Max 5MB — jpeg, png, webp, gif</p>
            </div>
          </div>
        </div>

        {error && (
          <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 border-2 border-foreground bg-gigs-pink text-foreground font-black uppercase text-lg px-8 py-4 brut-shadow brut-button disabled:opacity-50"
          >
            {submitting ? "SAVING..." : editing ? "SAVE CHANGES →" : "CREATE EVENT →"}
          </button>
          <Link
            to="/organizer/events"
            className="inline-flex items-center justify-center gap-2 border-2 border-foreground bg-canvas text-ink font-black uppercase text-lg px-8 py-4 brut-button"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}