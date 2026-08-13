import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [role, setRole] = useState("buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({ email, password, role, name });
        await login(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full border-2 border-foreground bg-canvas px-4 py-3 font-bold text-body-md focus:shadow-brut focus:outline-none";

  return (
    <section className="py-16 md:py-24 flex justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2">
          Join the<br/><span className="bg-foreground text-background px-2 inline-block brut-shadow -rotate-2">crowd.</span>
        </h1>
        <p className="font-bold text-lg mb-8">One ticket, a thousand stories.</p>

        <div className="flex border-4 border-foreground w-fit mb-8 brut-shadow-sm">
          {["login", "register"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className={
                "px-6 py-3 font-black uppercase tracking-tight " +
                (mode === m ? "bg-foreground text-background" : "bg-canvas text-ink hover:bg-gigs-yellow")
              }
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5">
          {mode === "register" && (
            <div>
              <label className="block font-black uppercase text-sm mb-1" htmlFor="name">Name</label>
              <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}

          <div>
            <label className="block font-black uppercase text-sm mb-1" htmlFor="email">Email</label>
            <input id="email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="block font-black uppercase text-sm mb-1" htmlFor="password">Password</label>
            <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {mode === "register" && (
            <div>
              <label className="block font-black uppercase text-sm mb-1" htmlFor="role">Role</label>
              <select id="role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="buyer">Buyer</option>
                <option value="organizer">Organizer</option>
              </select>
            </div>
          )}

          {error && (
            <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full border-2 border-foreground bg-gigs-pink text-foreground font-black uppercase text-lg px-8 py-4 brut-shadow brut-button disabled:opacity-50"
          >
            {submitting ? "..." : mode === "login" ? "EXPLORE EVENTS →" : "SIGN UP →"}
          </button>
        </form>
      </div>
    </section>
  );
}