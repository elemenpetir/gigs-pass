import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Pencil, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { Input, Label, Badge } from "@/components";
import { formatIDR } from "@/lib/format";

const emptyEdit = { id: null, name: "", price: "", quota: "" };

export default function CategoriesPage() {
  const { id } = useParams();

  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quota, setQuota] = useState("");
  const [creating, setCreating] = useState(false);

  const [edit, setEdit] = useState(emptyEdit);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchData = useCallback(async () => {
    const [eventData, catData] = await Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/categories`),
    ]);
    return { event: eventData.event, categories: catData.categories || [] };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then((data) => {
        if (cancelled) return;
        setEvent(data.event);
        setCategories(data.categories);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load ticket categories");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchData]);

  const refresh = async () => {
    const data = await fetchData();
    setEvent(data.event);
    setCategories(data.categories);
  };

  const createCategory = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api.post(`/events/${id}/categories`, {
        name,
        price: parseInt(price, 10),
        quota: parseInt(quota, 10),
      });
      setName("");
      setPrice("");
      setQuota("");
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to create category");
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async (categoryId) => {
    setError("");
    setSavingEdit(true);
    try {
      await api.put(`/categories/${categoryId}`, {
        name: edit.name,
        price: parseInt(edit.price, 10),
        quota: parseInt(edit.quota, 10),
      });
      setEdit(emptyEdit);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to update category");
    } finally {
      setSavingEdit(false);
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

      <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 flex items-center gap-4 flex-wrap">
        <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">TICKETS</span>
      </h1>
      <p className="font-bold text-lg mb-10">
        {event ? event.title : "Event"} — set your tiers, price, and quota.
      </p>

      {error && (
        <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm mb-6">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add form */}
        <form onSubmit={createCategory} className="border-4 border-foreground bg-gigs-purple p-6 brut-shadow space-y-5 h-fit">
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Plus size={22} strokeWidth={3} /> Add Tier
          </h2>

          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Early Bird" />
          </div>

          <div>
            <Label htmlFor="cat-price">Price (IDR)</Label>
            <Input id="cat-price" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="250000" />
          </div>

          <div>
            <Label htmlFor="cat-quota">Quota</Label>
            <Input id="cat-quota" type="number" min="1" step="1" value={quota} onChange={(e) => setQuota(e.target.value)} required placeholder="500" />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full border-2 border-foreground bg-foreground text-background font-black uppercase text-lg px-6 py-3 brut-shadow brut-button disabled:opacity-50"
          >
            {creating ? "ADDING..." : "ADD TIER →"}
          </button>
        </form>

        {/* Category list */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="hidden md:grid grid-cols-12 gap-4 py-4 border-b-4 border-foreground text-sm font-bold uppercase tracking-widest">
            <div className="col-span-4">TIER</div>
            <div className="col-span-3">PRICE</div>
            <div className="col-span-2">QUOTA</div>
            <div className="col-span-3 text-right">ACTIONS</div>
          </div>

          {categories.length === 0 ? (
            <div className="border-4 border-foreground bg-canvas p-10 text-center">
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">no tiers yet</h3>
              <p className="font-bold">Add your first ticket tier to open the queue. <span className="text-gigs-pink">✸</span></p>
            </div>
          ) : (
            categories.map((cat) => {
              const isEditing = edit.id === cat.id;
              return (
                <div key={cat.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b-2 border-foreground/30 items-center hover:bg-surface-card transition-colors">
                  {isEditing ? (
                    <>
                      <div className="col-span-1 md:col-span-4">
                        <Input value={edit.name} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} required />
                      </div>
                      <div className="col-span-1 md:col-span-3">
                        <Input type="number" min="0" step="1" value={edit.price} onChange={(e) => setEdit((p) => ({ ...p, price: e.target.value }))} required />
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <Input type="number" min="1" step="1" value={edit.quota} onChange={(e) => setEdit((p) => ({ ...p, quota: e.target.value }))} required />
                      </div>
                      <div className="col-span-1 md:col-span-3 flex gap-2 md:justify-end">
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => saveEdit(cat.id)}
                          className="inline-flex items-center gap-2 bg-gigs-teal text-ink px-4 py-2 font-black uppercase text-sm brut-border-2 brut-button disabled:opacity-50"
                        >
                          <Check size={16} /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEdit(emptyEdit)}
                          className="inline-flex items-center gap-2 bg-canvas text-ink px-4 py-2 font-black uppercase text-sm brut-border-2 brut-button"
                        >
                          <X size={16} /> Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-1 md:col-span-4">
                        <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">{cat.name}</h3>
                      </div>
                      <div className="col-span-1 md:col-span-3 font-black text-lg">{formatIDR(cat.price)}</div>
                      <div className="col-span-1 md:col-span-2">
                        <Badge variant="default">{cat.quota} slots</Badge>
                      </div>
                      <div className="col-span-1 md:col-span-3 flex gap-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => setEdit({ id: cat.id, name: cat.name, price: String(cat.price), quota: String(cat.quota) })}
                          className="inline-flex items-center gap-2 bg-canvas text-ink px-4 py-2 font-black uppercase text-sm brut-border-2 brut-button"
                        >
                          <Pencil size={16} /> Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}