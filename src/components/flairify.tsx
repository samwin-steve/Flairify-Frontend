"use client";
import { useEffect, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  ArrowDown,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Compass,
  Heart,
  ImagePlus,
  Leaf,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { api, post, del } from "@/lib/api";
import { money } from "@/lib/utils";
import type {
  Config,
  Conversation,
  Duplicate,
  Message,
  Outfit,
  Job,
  Photo,
  Product,
  Profile,
  Reference,
  Shop,
  WardrobeItem,
} from "@/lib/types";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Media } from "./media";
import {
  Onboarding,
  ProfileForm,
  UploadZone,
  WardrobeReview,
  PersonSelection,
  PhotoPicker,
} from "./onboarding";
import { FittingRoom } from "./fitting-room";
import { Admin } from "./admin";
import { Inventory } from "./inventory";
import { TryOnDialog } from "./try-on-dialog";

const navigation = [
  { id: "stylist", label: "Stylist", icon: Sparkles },
  { id: "wardrobe", label: "My Wardrobe", icon: Shirt },
  { id: "inventory", label: "Inventory", icon: StoreIcon },
  { id: "saved", label: "Saved Looks", icon: Bookmark },
  { id: "fitting", label: "Fitting Room", icon: WandSparkles },
  { id: "profile", label: "Profile", icon: UserRound },
];
const prompts = [
  {
    icon: Compass,
    title: "A trip, thoughtfully packed",
    text: "Three days in Mumbai for work. I’ll be walking a lot. My budget is ₹5,000, and I want pieces I’ll wear again.",
    label: "Help me pack for Mumbai",
  },
  {
    icon: Shirt,
    title: "More from what you own",
    text: "Which jacket under ₹3,000 works with the most distinct outfits in my wardrobe?",
    label: "Find my most versatile jacket",
  },
  {
    icon: Heart,
    title: "A little everyday inspiration",
    text: "Help me make a relaxed everyday outfit with pieces I already own, within ₹3,000.",
    label: "Make everyday feel like me",
  },
];

export function Flairify() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 20000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Application />
    </QueryClientProvider>
  );
}

function Application() {
  const qc = useQueryClient();
  const [session, setSession] = useState(false);
  const [boot, setBoot] = useState(true);
  const [page, setPage] = useState("stylist");
  const [onboarding, setOnboarding] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [details, setDetails] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [register, setRegister] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [storeId, setStoreId] = useState("");
  const [tryOn, setTryOn] = useState<{
    products: Product[];
    id?: string;
  } | null>(null);
  const [activeLook, setActiveLook] = useState<Outfit | null>(null);
  const [clothingSize, setClothingSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const [toast, setToast] = useState("");
  const [addPhotos, setAddPhotos] = useState(false);
  const [filter, setFilter] = useState("all");
  const [messages, setMessages] = useState<Message[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<Config>("/config"),
  });
  useEffect(() => {
    const existing = localStorage.getItem("flairify-token");
    setSession(!!existing);
    const sizes = sessionStorage.getItem("flairify-sizes");
    if (sizes) {
      try {
        const s = JSON.parse(sizes);
        setClothingSize(s.clothing_size || "");
        setShoeSize(s.shoe_size || "");
      } catch {}
    }
    const url = new URL(window.location.href);
    setStoreId(url.searchParams.get("store") || "");
    let unsubscribe = () => {};
    fetch("/config")
      .then((r) => r.json())
      .then(({ firebase }) => {
        if (firebase.apiKey && firebase.appId) {
          if (!getApps().length) initializeApp(firebase);
          setFirebaseReady(true);
          unsubscribe = onAuthStateChanged(getAuth(), (user) => {
            if (user) {
              setSession(true);
              qc.invalidateQueries();
            }
            setBoot(false);
          });
        } else setBoot(false);
      })
      .catch(() => setBoot(false));
    return () => unsubscribe();
  }, [qc]);
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<Profile>("/profile"),
    enabled: session,
  });
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api<{ jobs: Job[] }>("/jobs"),
    enabled: session,
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => ["queued", "running"].includes(j.status))
        ? 2000
        : false,
  });
  const pendingJobs =
    jobs.data?.jobs.filter(
      (j) => j.kind === "wardrobe" && ["queued", "running"].includes(j.status),
    ) || [];
  const wardrobe = useQuery({
    queryKey: ["wardrobe"],
    queryFn: () =>
      api<{
        items: WardrobeItem[];
        confirmed_count: number;
        duplicates: Duplicate[];
      }>("/wardrobe"),
    enabled: session,
    refetchInterval: addPhotos || pendingJobs.length > 0 ? 2000 : false,
  });
  useEffect(() => {
    if (jobs.data) qc.invalidateQueries({ queryKey: ["wardrobe"] });
  }, [jobs.data, qc]);
  const saved = useQuery({
    queryKey: ["saved"],
    queryFn: () => api<{ looks: { id: string; outfit: Outfit }[] }>("/saved"),
    enabled: session,
  });
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<{ conversations: Conversation[] }>("/conversations"),
    enabled: session,
  });
  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => api<{ stores: Shop[] }>("/stores"),
    enabled: session,
  });
  const photos = useQuery({
    queryKey: ["photos"],
    queryFn: () => api<{ photos: Photo[]; references: Reference[] }>("/photos"),
    enabled: session,
  });
  useEffect(() => {
    if (profile.data) {
      if (profile.data.clothing_size)
        setClothingSize(profile.data.clothing_size);
      if (profile.data.shoe_size) setShoeSize(profile.data.shoe_size);
    }
  }, [profile.data]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!onboarding) {
      try {
        const s = JSON.parse(sessionStorage.getItem("flairify-sizes") || "{}");
        if (s.clothing_size) setClothingSize(s.clothing_size);
        if (s.shoe_size) setShoeSize(s.shoe_size);
      } catch {}
    }
  }, [onboarding]);
  const confirmed = wardrobe.data?.items.filter((w) => w.confirmed) || [];
  const ready = !!profile.data?.onboarding_complete && confirmed.length > 0;
  const latestOutfits =
    messages.filter((m) => m.role === "assistant").at(-1)?.outfits || [];
  const summaryLook = activeLook || latestOutfits[0];
  function changePage(id: string) {
    setPage(id);
    setMobileMenu(false);
    setError("");
  }
  function refresh() {
    qc.invalidateQueries({ queryKey: ["wardrobe"] });
    qc.invalidateQueries({ queryKey: ["photos"] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  async function action(fn: () => Promise<unknown>) {
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function startDemo() {
    setBusy(true);
    await action(async () => {
      if (getApps().length && getAuth().currentUser) await signOut(getAuth());
      const r = await post<{ token: string }>("/auth/demo");
      localStorage.setItem("flairify-token", r.token);
      qc.clear();
      setSession(true);
      setOnboarding(true);
    });
    setBusy(false);
  }
  async function login(google = false) {
    setBusy(true);
    await action(async () => {
      if (!firebaseReady)
        throw new Error(
          "Account sign-in is not configured for this demo. Explore using a private demo session.",
        );
      if (google) await signInWithPopup(getAuth(), new GoogleAuthProvider());
      else if (register)
        await createUserWithEmailAndPassword(getAuth(), email, password);
      else await signInWithEmailAndPassword(getAuth(), email, password);
      localStorage.removeItem("flairify-token");
      setSession(true);
      setAuthOpen(false);
      qc.invalidateQueries();
      const signedInProfile = await api<Profile>("/profile");
      qc.setQueryData(["profile"], signedInProfile);
      setOnboarding(!signedInProfile.onboarding_complete);
    });
    setBusy(false);
  }
  async function logout() {
    if (getApps().length) await signOut(getAuth());
    localStorage.removeItem("flairify-token");
    sessionStorage.removeItem("flairify-sizes");
    setSession(false);
    setOnboarding(false);
    setMessages([]);
    setConvoId(null);
    qc.clear();
    setPage("stylist");
  }
  async function send(text = input) {
    if (!text.trim() || busy) return;
    if (!ready) {
      setOnboarding(true);
      return;
    }
    setInput("");
    setBusy(true);
    setError("");
    const draft: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      outfits: [],
      created_at: new Date().toISOString(),
    };
    setMessages((old) => [...old, draft]);
    try {
      const result = await post<{
        conversation: Conversation;
        outfits: Outfit[];
      }>("/chat", {
        message: text,
        conversation_id: convoId,
        store_id: storeId || null,
        clothing_size: clothingSize || null,
        shoe_size: shoeSize || null,
      });
      setConvoId(result.conversation.id);
      setMessages(result.conversation.messages);
      setActiveLook(result.outfits[0] || null);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      setMessages((old) => old.filter((m) => m.id !== draft.id));
      setInput(text);
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(
        () =>
          bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
        80,
      );
    }
  }
  async function saveLook(outfit: Outfit) {
    await action(async () => {
      await post("/saved/" + outfit.id);
      qc.invalidateQueries({ queryKey: ["saved"] });
      setToast("A good look, saved for later.");
    });
  }
  function openTryOn(outfit: { products: Product[]; id?: string }) {
    setTryOn(outfit);
  }
  async function nearby() {
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable in this browser. Choose a store manually.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api<{ stores: Shop[] }>(
          "/stores?lat=" + pos.coords.latitude + "&lon=" + pos.coords.longitude,
        )
          .then((data) => {
            qc.setQueryData(["stores"], data);
            setDetails(true);
          })
          .catch((e) => setError(e.message));
      },
      () =>
        setError("Location wasn’t shared. You can choose a store manually."),
    );
  }

  if (boot)
    return (
      <div className="loading-page">
        <div className="wordmark">
          flairify<span>✧</span>
        </div>
        <LoaderCircle className="spin" />
      </div>
    );
  if (onboarding && profile.data && config.data)
    return (
      <Onboarding
        profile={profile.data}
        config={config.data}
        onExit={() => setOnboarding(false)}
        onComplete={() => {
          setOnboarding(false);
          refresh();
          setToast("Your wardrobe is ready.");
        }}
      />
    );
  if (!session)
    return (
      <div className="landing">
        <header className="landing-nav">
          <div className="wordmark">
            flairify<span>✧</span>
          </div>
          <nav>
            {config.data?.mode === "demo" && (
              <span className="pill">Demo data</span>
            )}
            <a href="#how-it-works">A wardrobe with possibilities</a>
            <Button variant="ghost" onClick={() => setAuthOpen(true)}>
              Sign in <ArrowRight size={15} />
            </Button>
          </nav>
        </header>
        <main>
          <div className="landing-hero">
            <div className="landing-copy">
              <div className="eyebrow">
                <span /> YOUR STYLE. YOUR LIFE. A LITTLE MORE YOU.
              </div>
              <h1>
                A wardrobe full
                <br />
                of <em>possibilities.</em>
              </h1>
              <p>
                Share your wardrobe once. Find pieces that work with your
                life—and see the look on you.
              </p>
              <div className="landing-buttons">
                <Button
                  onClick={
                    firebaseReady || config.data?.mode === "production"
                      ? () => {
                          setRegister(true);
                          setAuthOpen(true);
                        }
                      : startDemo
                  }
                  disabled={busy}
                >
                  {busy ? <LoaderCircle className="spin" size={18} /> : null}
                  Meet your personal stylist <ArrowRight size={18} />
                </Button>
                {config.data?.mode === "demo" && (
                  <button
                    className="text-link"
                    onClick={startDemo}
                    disabled={busy}
                  >
                    Explore sample demo
                  </button>
                )}
              </div>
              <div className="landing-principles">
                <span>
                  <Shirt size={18} />
                  Wardrobe first
                </span>
                <span>
                  <Heart size={18} />
                  Thoughtful choices
                </span>
                <span>
                  <ShieldCheck size={18} />
                  Always your say
                </span>
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </div>
            <div className="landing-visual">
              <img
                className="hero-photo"
                src="/images/hero.jpg"
                alt="Editorial style inspiration: a woman wearing a light blazer"
              />
              <div className="hero-caption">
                <span>EVERYDAY, BUT A LITTLE MORE YOU.</span>
                <h2>
                  Good style starts
                  <br />
                  with your story.
                </h2>
              </div>
              <div className="floating-look">
                <img
                  src="/images/blazer.jpg"
                  alt="Sample beige blazer inspiration"
                />
                <div>
                  <span>ONE THOUGHTFUL ADDITION</span>
                  <strong>
                    More ways to wear
                    <br />
                    what you already own.
                  </strong>
                </div>
                <Heart size={18} />
              </div>
              <span className="editorial-tag">
                Editorial inspiration · Unsplash
              </span>
            </div>
          </div>
          <section className="how-it-works" id="how-it-works">
            <div>
              <span className="eyebrow">LESS GUESSWORK. MORE YOU.</span>
              <h2>Your style, connected.</h2>
            </div>
            {[
              {
                n: "01",
                title: "Bring your wardrobe",
                text: "A few photos. Confirm the pieces you own. Keep the final say.",
              },
              {
                n: "02",
                title: "Tell us what’s happening",
                text: "A work trip, a weekend, or just a new way to wear your favourites.",
              },
              {
                n: "03",
                title: "Make room for the right piece",
                text: "See outfits that respect your budget and work with your life.",
              },
            ].map((s) => (
              <article key={s.n}>
                <span>{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </section>
        </main>
        <footer className="landing-footer">
          <span>flairify · Buy thoughtfully. Wear happily.</span>
          <span>
            {config.data?.mode === "demo"
              ? "Demo data · Sample wardrobe, prices & stores"
              : "Wardrobe-first retail shopping"}
          </span>
          <a href="/image-credits.json" target="_blank">
            Photo credits
          </a>
        </footer>
        {authOpen && (
          <Modal
            open
            onOpenChange={setAuthOpen}
            title={register ? "A little more you." : "Welcome back."}
            description="Flairify sign-in does not authorize access to Google Photos."
          >
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                login();
              }}
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => login(true)}
                disabled={busy || !firebaseReady}
              >
                <span className="google-g">G</span>Continue with Google
              </Button>
              <div className="divider">or</div>
              <label className="field">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                Password
                <input
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Button disabled={busy || !firebaseReady}>
                {register ? "Create account" : "Sign in"}
              </Button>
              <button
                type="button"
                className="text-link"
                onClick={() => setRegister(!register)}
              >
                {register ? "Already have an account?" : "Create an account"}
              </button>
              {!firebaseReady && (
                <div className="notice">
                  <p>
                    Account sign-in is not connected in this demo. A private
                    demo session lets you explore without credentials.
                  </p>
                  <Button type="button" onClick={startDemo}>
                    Explore demo
                  </Button>
                </div>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </form>
          </Modal>
        )}
      </div>
    );
  const nav = (
    <>
      <div className="sidebar-top">
        <button className="wordmark" onClick={() => changePage("stylist")}>
          flairify<span>✧</span>
        </button>
        <p>A LITTLE MORE YOU.</p>
      </div>
      <nav className="primary-nav" aria-label="Main navigation">
        {navigation.map((n) => (
          <button
            key={n.id}
            onClick={() => changePage(n.id)}
            className={page === n.id ? "active" : ""}
          >
            <n.icon size={19} />
            <span>{n.label}</span>
            {n.id === "wardrobe" && <small>{confirmed.length}</small>}
            {n.id === "saved" && !!saved.data?.looks.length && (
              <small>{saved.data.looks.length}</small>
            )}
          </button>
        ))}
      </nav>
      <div className="wardrobe-status">
        <div>
          <span className="circle-icon small">
            <Shirt size={18} />
          </span>
          <strong>Your wardrobe</strong>
          <span className="status-dot" />
        </div>
        <p>
          {confirmed.length} confirmed pieces.
          <br />
          {ready
            ? "Ready for a new possibility."
            : "A little start goes a long way."}
        </p>
        <button
          onClick={() => (ready ? changePage("wardrobe") : setOnboarding(true))}
        >
          {ready ? "View your wardrobe" : "Build your wardrobe"}
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="history">
        <div className="section-line">
          <span>OUR CONVERSATIONS</span>
          <button
            className="icon-button small"
            onClick={() => {
              setConvoId(null);
              setMessages([]);
              setActiveLook(null);
              changePage("stylist");
            }}
            aria-label="New conversation"
          >
            <Plus size={16} />
          </button>
        </div>
        {conversations.data?.conversations.slice(0, 5).map((c) => (
          <button
            className={convoId === c.id ? "selected" : ""}
            key={c.id}
            onClick={() => {
              setConvoId(c.id);
              setMessages(c.messages);
              setActiveLook(null);
              changePage("stylist");
            }}
          >
            <MessageCircle size={15} />
            <span>{c.title}</span>
          </button>
        ))}
        {!conversations.data?.conversations.length && (
          <p>Your next good idea starts here.</p>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="planet-note">
          <Leaf size={17} />
          <span>
            Love your wardrobe.
            <br />
            Make the most of it.
          </span>
        </div>
        <button
          className="account-button"
          onClick={() => changePage("profile")}
        >
          <span className="avatar">{profile.data?.name?.[0] || "Y"}</span>
          <div>
            <strong>{profile.data?.name || "Your space"}</strong>
            <small>Your personal style space</small>
          </div>
          <Settings2 size={17} />
        </button>
      </div>
    </>
  );
  const detailsPanel = (
    <>
      <div className="details-heading">
        <h3>Your outfit notebook</h3>
        <span>THE PIECES THAT MAKE IT YOU</span>
      </div>
      <div className="section-line">
        <strong>From your wardrobe</strong>
        <span className="pill">Owned</span>
      </div>
      <div className="wardrobe-mini-grid">
        {(summaryLook?.owned || confirmed).slice(0, 4).map((w) => (
          <div key={w.id} className="mini-garment">
            <Media src={w.image} alt={w.name} />
            <strong>{w.name}</strong>
            <small>{w.colour}</small>
          </div>
        ))}
      </div>
      {!confirmed.length && (
        <div className="mini-empty">
          <Shirt size={28} />
          <p>Your favourites belong here.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOnboarding(true)}
          >
            Add your wardrobe
          </Button>
        </div>
      )}
      {summaryLook && (
        <>
          <div className="section-line details-section">
            <strong>A thoughtful addition</strong>
            <span className="pill rose">New</span>
          </div>
          {summaryLook.products.map((p) => (
            <div className="selected-product" key={p.id}>
              <Media src={p.image} alt={p.name} catalog />
              <div>
                <strong>{p.name}</strong>
                <span>
                  {money(p.price)} · Size {p.availability?.size}
                </span>
                <small>{p.store?.name}</small>
              </div>
            </div>
          ))}
          <div className="budget-note">
            <span>Total for new pieces</span>
            <strong>{money(summaryLook.total)}</strong>
            <small>Owned pieces add ₹0. No need to buy the whole look.</small>
          </div>
        </>
      )}
      <div className="store-note">
        <MapPin size={18} />
        <div>
          <strong>Your store, your choice</strong>
          <select
            aria-label="Select store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">All available stores</option>
            {stores.data?.stores.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="text-link" onClick={nearby}>
            Find stores near me
          </button>
          {stores.data?.stores
            .filter((s) => s.distance_km !== undefined)
            .map((s) => (
              <p className="fine-print" key={s.id}>
                {s.name}: {s.distance_km} km
                <br />
                {s.distance_label}
              </p>
            ))}
        </div>
      </div>
      <div className="gentle-note">
        <Heart size={19} />
        <p>
          Something you’ll wear again
          <br />
          is always a good place to start.
        </p>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">{nav}</aside>
      <div className="app-body">
        <header className="app-header">
          <div className="header-title">
            <button
              className="icon-button mobile-only"
              onClick={() => setMobileMenu(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <span>
              {navigation.find((n) => n.id === page)?.label ||
                "Retailer workspace"}
            </span>
            <span className="header-separator" />
            <small>Good style. Better possibilities.</small>
          </div>
          <div className="header-actions">
            {config.data?.mode === "demo" && (
              <span className="demo-badge">
                <span />
                Demo data
              </span>
            )}
            <button
              className="icon-button mobile-details"
              onClick={() => setDetails(true)}
              aria-label="Open outfit notebook"
            >
              <SlidersHorizontal size={20} />
            </button>
            <button
              className="avatar"
              onClick={() => changePage("profile")}
              aria-label="Open profile"
            >
              {profile.data?.name?.[0] || "Y"}
            </button>
          </div>
        </header>
        {profile.isError && (
          <div className="notice error">
            Your session may have expired.
            <button className="text-link" onClick={logout}>
              Sign in again
            </button>
          </div>
        )}
        {error && (
          <div className="app-error" role="alert">
            {error}
            <button
              className="icon-button small"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {page === "stylist" && (
          <div className="stylist-layout">
            <main className="conversation">
              <div className="conversation-scroll">
                {!messages.length ? (
                  <>
                    <div className="stylist-intro">
                      <div className="eyebrow">
                        <span className="tiny-star">✧</span> YOUR WARDROBE. A
                        WORLD OF POSSIBILITIES.
                      </div>
                      <h1>
                        Hi{" "}
                        {profile.data?.name && profile.data.name !== "Friend"
                          ? profile.data.name
                          : "there"}
                        ,<br />
                        what’s on your <em>agenda?</em>
                      </h1>
                      <p>
                        A busy week, a little getaway, or just feeling like
                        yourself.
                        <br className="desktop-break" /> Let’s find a look for
                        wherever life takes you.
                      </p>
                    </div>
                    {!ready && (
                      <div className="onboarding-nudge">
                        <span className="circle-icon">
                          <Shirt size={23} />
                        </span>
                        <div>
                          <strong>Good style starts with what you own.</strong>
                          <p>
                            Share a few photos and confirm your wardrobe first.
                          </p>
                        </div>
                        <Button size="sm" onClick={() => setOnboarding(true)}>
                          Let’s start <ArrowRight size={16} />
                        </Button>
                      </div>
                    )}
                    <div className="agenda-cards">
                      {prompts.map((p) => (
                        <button
                          className="agenda-card"
                          key={p.title}
                          onClick={() =>
                            ready ? send(p.text) : setOnboarding(true)
                          }
                        >
                          <p.icon size={22} />
                          <h3>{p.title}</h3>
                          <p>{p.label}</p>
                          <ArrowRight className="card-arrow" size={18} />
                        </button>
                      ))}
                    </div>
                    <div className="editorial-card">
                      <img
                        src="/images/hero.jpg"
                        alt="Editorial outfit inspiration in a light blazer"
                      />
                      <div>
                        <span className="eyebrow">
                          STYLE ISN’T ALWAYS SOMETHING NEW
                        </span>
                        <h2>
                          New plans.
                          <br />
                          Old favourites.
                          <br />
                          <em>A little flair.</em>
                        </h2>
                        <p>
                          Your next great outfit might already
                          <br />
                          be halfway there.
                        </p>
                        <button onClick={() => changePage("wardrobe")}>
                          Rediscover your wardrobe <ArrowRight size={17} />
                        </button>
                      </div>
                      <span className="editorial-source">
                        Editorial photo · Unsplash
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="messages">
                    {messages.map((m) => (
                      <div key={m.id} className={"message " + m.role}>
                        {m.role === "assistant" && (
                          <span className="stylist-avatar">✧</span>
                        )}
                        <div className="message-body">
                          {m.role === "assistant" && (
                            <span className="assistant-label">
                              YOUR FLAIRIFY STYLIST{" "}
                              <small>
                                {config.data?.chat === "rules"
                                  ? "Rule-based demo"
                                  : "Grounded assistance"}
                              </small>
                            </span>
                          )}
                          <p>{m.content}</p>
                          {m.outfits?.map((o, i) => (
                            <LookCard
                              key={o.id}
                              outfit={o}
                              index={i}
                              isSaved={
                                !!saved.data?.looks.some((s) => s.id === o.id)
                              }
                              onSave={() => saveLook(o)}
                              onTryOn={() => openTryOn(o)}
                              onSelect={() => {
                                setActiveLook(o);
                                setDetails(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {busy && (
                      <div className="thinking">
                        <span className="stylist-avatar">✧</span>
                        <LoaderCircle size={16} className="spin" />
                        Checking your wardrobe and available sizes…
                      </div>
                    )}
                    <div ref={bottom} />
                  </div>
                )}
              </div>
              <div className="composer-area">
                {messages.length > 0 && !busy && (
                  <div className="followup-chips">
                    {[
                      "Something cheaper",
                      "More relaxed",
                      "Keep my shirt",
                      "Show another jacket",
                    ].map((t) => (
                      <button key={t} onClick={() => send(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {ready && (!clothingSize || !shoeSize) && (
                  <div className="size-followup">
                    <span>Which sizes should I check?</span>
                    <label>
                      Clothing
                      <select
                        value={clothingSize}
                        onChange={(e) => {
                          setClothingSize(e.target.value);
                          sessionStorage.setItem(
                            "flairify-sizes",
                            JSON.stringify({
                              clothing_size: e.target.value,
                              shoe_size: shoeSize,
                            }),
                          );
                        }}
                      >
                        <option value="">Select</option>
                        {["XS", "S", "M", "L", "XL"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Shoes (EU)
                      <select
                        value={shoeSize}
                        onChange={(e) => {
                          setShoeSize(e.target.value);
                          sessionStorage.setItem(
                            "flairify-sizes",
                            JSON.stringify({
                              clothing_size: clothingSize,
                              shoe_size: e.target.value,
                            }),
                          );
                        }}
                      >
                        <option value="">Select</option>
                        {[35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                )}
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                >
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Add wardrobe photos"
                    onClick={() =>
                      ready ? setAddPhotos(true) : setOnboarding(true)
                    }
                  >
                    <Plus size={23} />
                  </button>
                  <textarea
                    aria-label="Message your stylist"
                    placeholder={
                      ready
                        ? "Tell me what you’re dressing for…"
                        : "Start with your wardrobe, then let’s talk style…"
                    }
                    value={input}
                    rows={1}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <button
                    className="send-button"
                    aria-label="Send message"
                    disabled={busy || !input.trim()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={19} />
                    ) : (
                      <ArrowRight size={21} />
                    )}
                  </button>
                </form>
                <div className="composer-note">
                  <ShieldCheck size={12} />
                  <span>Your wardrobe stays yours.</span>
                  <span className="composer-note-right">
                    {config.data?.mode === "demo"
                      ? "Sample catalogue · No live retailer connected"
                      : "Prices and sizes checked against retailer records"}
                  </span>
                </div>
              </div>
            </main>
            <aside className="outfit-details">{detailsPanel}</aside>
          </div>
        )}
        {page === "wardrobe" && (
          <main className="page-content">
            <div className="section-line">
              <span className="eyebrow">THE PIECES THAT MAKE IT YOU</span>
              <Button onClick={() => setAddPhotos(true)} size="sm">
                <Plus size={16} />
                Add photos
              </Button>
            </div>
            <h1>Your wardrobe, reimagined.</h1>
            <p className="page-subtitle">
              {confirmed.length} confirmed pieces. A whole lot of possibility.
            </p>
            <div className="tabs">
              {["all", "top", "bottom", "jacket", "shoes", "dress", "bag"].map(
                (c) => (
                  <button
                    key={c}
                    className={filter === c ? "active" : ""}
                    onClick={() => setFilter(c)}
                  >
                    {c === "all"
                      ? "All pieces"
                      : c.charAt(0).toUpperCase() + c.slice(1) + "s"}
                  </button>
                ),
              )}
            </div>
            <>
              {pendingJobs.map((j) => (
                <div className="notice" role="status" key={j.id}>
                  <LoaderCircle className="spin" size={18} />
                  {j.stage}
                </div>
              ))}
            </>
            <WardrobeReview
              items={(wardrobe.data?.items || []).filter(
                (i) => filter === "all" || i.category === filter,
              )}
              duplicates={wardrobe.data?.duplicates || []}
              onRefresh={refresh}
            />
            {!wardrobe.data?.items.length && (
              <div className="empty-state">
                <Shirt size={32} />
                <h2>Let’s start with your favourites.</h2>
                <p>A few outfit photos are enough to begin.</p>
                <Button onClick={() => setOnboarding(true)}>
                  Build my wardrobe
                </Button>
              </div>
            )}
          </main>
        )}
        {page === "saved" && (
          <main className="page-content">
            <span className="eyebrow">GOOD IDEAS, KEPT CLOSE</span>
            <h1>Looks worth coming back to.</h1>
            <p className="page-subtitle">
              A little inspiration for another day.
            </p>
            {!saved.data?.looks.length ? (
              <div className="empty-state">
                <Bookmark size={32} />
                <h2>Your favourites will feel at home here.</h2>
                <p>
                  Save a stylist recommendation to keep the whole combination.
                </p>
                <Button onClick={() => changePage("stylist")}>
                  Find a look <ArrowRight size={16} />
                </Button>
              </div>
            ) : (
              <div className="saved-grid">
                {saved.data.looks.map((s, i) => (
                  <div key={s.id}>
                    <LookCard
                      outfit={s.outfit}
                      index={i}
                      isSaved
                      onSave={() =>
                        action(async () => {
                          await del("/saved/" + s.id);
                          qc.invalidateQueries({ queryKey: ["saved"] });
                        })
                      }
                      onTryOn={() => openTryOn(s.outfit)}
                      onSelect={() => {
                        setActiveLook(s.outfit);
                        setDetails(true);
                      }}
                    />
                    <p className="fine-print">
                      Saved prices and availability are a snapshot. Ask your
                      stylist to recheck before buying.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}
        {page === "inventory" && (
          <Inventory onTryOn={(p) => openTryOn({ products: [p] })} />
        )}
        {page === "fitting" && (
          <FittingRoom
            onShop={() => changePage("inventory")}
            onWardrobe={() => changePage("wardrobe")}
          />
        )}
        {page === "profile" && profile.data && (
          <main className="page-content">
            <span className="eyebrow">ALWAYS YOUR SAY</span>
            <h1>Your space, your preferences.</h1>
            <div className="profile-columns">
              <div className="white-panel">
                <ProfileForm
                  profile={profile.data}
                  onSaved={() => {
                    refresh();
                    setToast("Your preferences are updated.");
                  }}
                />
              </div>
              <div>
                <div className="white-panel">
                  <h3>Private by design.</h3>
                  <p>
                    Google sign-in and Google Photos permissions are separate.
                    You choose what to share.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => changePage("fitting")}
                  >
                    Manage reference photos
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => changePage("wardrobe")}
                  >
                    Manage wardrobe and photos
                  </Button>
                </div>
                <div className="white-panel integration-status">
                  <h3>What’s connected</h3>
                  <p>
                    <span>Catalogue</span>
                    <strong>
                      {config.data?.mode === "demo"
                        ? "Sample data"
                        : "Retailer records"}
                    </strong>
                  </p>
                  <p>
                    <span>Photo analysis</span>
                    <strong>
                      {config.data?.analysis === "manual"
                        ? "Manual review"
                        : "Gemini"}
                    </strong>
                  </p>
                  <p>
                    <span>Try-on / video</span>
                    <strong>
                      {config.data?.try_on
                        ? "Configured; access required"
                        : "Not connected"}
                    </strong>
                  </p>
                  <p>
                    <span>Personalized 3D</span>
                    <strong>Experimental</strong>
                  </p>
                </div>
                <Button variant="ghost" onClick={() => changePage("admin")}>
                  <StoreIcon size={17} />
                  Retailer workspace
                </Button>
                <Button variant="ghost" onClick={logout}>
                  <LogOut size={17} />
                  Sign out
                </Button>
              </div>
            </div>
            <section className="photo-management">
              <h2>Your source photos</h2>
              <p className="fine-print">
                Deleting a source also removes its extracted garments and
                invalidates associated looks.
              </p>
              <div className="source-grid">
                {photos.data?.photos.map((p) => (
                  <div className="white-panel" key={p.id}>
                    <Media
                      src={"media:" + p.media_id}
                      alt="Private wardrobe source"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        action(async () => {
                          await del("/photos/" + p.id);
                          refresh();
                        })
                      }
                    >
                      Delete photo & extracted garments
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}
        {page === "admin" && profile.data && <Admin profile={profile.data} />}
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => changePage(n.id)}
            >
              <n.icon size={20} />
              <span>
                {n.label === "My Wardrobe"
                  ? "Wardrobe"
                  : n.label === "Fitting Room"
                    ? "Fitting"
                    : n.label === "Saved Looks"
                      ? "Saved"
                      : n.label}
              </span>
            </button>
          ))}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {mobileMenu && (
        <Modal
          open
          onOpenChange={setMobileMenu}
          title="Your Flairify"
          description="Your personal style space."
        >
          <div className="mobile-sidebar">{nav}</div>
        </Modal>
      )}
      {details && (
        <Modal open onOpenChange={setDetails} title="Your outfit notebook">
          <div className="drawer-details">{detailsPanel}</div>
        </Modal>
      )}
      {tryOn && config.data && profile.data && (
        <TryOnDialog
          products={tryOn.products}
          outfitId={tryOn.id}
          config={config.data}
          profile={profile.data}
          onClose={() => setTryOn(null)}
          onQueued={() => {
            setTryOn(null);
            changePage("fitting");
          }}
          onSignIn={async () => {
            setTryOn(null);
            await logout();
            setRegister(true);
            setAuthOpen(true);
          }}
        />
      )}
      {addPhotos && config.data && (
        <Modal
          open
          onOpenChange={setAddPhotos}
          wide
          title="A little more of your wardrobe"
          description="Share only the photos you want to add."
        >
          <UploadZone onDone={refresh} />
          <PhotoPicker config={config.data} onDone={refresh} />
          {photos.data?.photos.slice(-12).map((p) => (
            <PersonSelection key={p.id} photo={p} onSaved={refresh} />
          ))}
          <Button
            onClick={() =>
              action(async () => {
                await post("/wardrobe/import", {
                  photo_ids: photos.data?.photos.slice(-12).map((p) => p.id),
                });
                setAddPhotos(false);
                changePage("wardrobe");
                setToast(
                  "Processing started. Review the new garments when ready.",
                );
                qc.invalidateQueries({ queryKey: ["jobs"] });
                setTimeout(refresh, 1500);
              })
            }
            disabled={!photos.data?.photos.length}
          >
            Find clothes for review <ArrowRight size={16} />
          </Button>
        </Modal>
      )}
    </div>
  );
}

function LookCard({
  outfit,
  index,
  isSaved,
  onSave,
  onTryOn,
  onSelect,
}: {
  outfit: Outfit;
  index: number;
  isSaved: boolean;
  onSave: () => void;
  onTryOn: () => void;
  onSelect: () => void;
}) {
  return (
    <article className="look-card">
      <div className="look-heading">
        <div>
          <span className="eyebrow">
            LOOK {String(index + 1).padStart(2, "0")} ·{" "}
            {outfit.occasion.toUpperCase()}
          </span>
          <h3>{outfit.title}</h3>
        </div>
        <button
          className={"icon-button " + (isSaved ? "saved" : "")}
          aria-label={isSaved ? "Remove saved look" : "Save look"}
          onClick={onSave}
        >
          <Bookmark size={20} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="look-pieces">
        {outfit.owned.map((w) => (
          <div className="look-piece" key={w.id}>
            <div className="look-image">
              <Media src={w.image} alt={w.name} />
              <span className="piece-label owned">Owned</span>
            </div>
            <strong>{w.name}</strong>
            <span>Already yours</span>
          </div>
        ))}
        {outfit.products.map((p) => (
          <div className="look-piece" key={p.id}>
            <div className="look-image">
              <Media src={p.image} alt={p.name} catalog />
              <span className="piece-label">
                New {p.sample ? "· Sample" : ""}
              </span>
            </div>
            <strong>{p.name}</strong>
            <span>
              {money(p.price)} · {p.availability?.size}
            </span>
          </div>
        ))}
      </div>
      <div className="look-explanation">
        <span className="tiny-star">✧</span>
        <p>{outfit.explanation}</p>
      </div>
      {!outfit.complete && (
        <p className="small-note">
          Partial combination: add missing base pieces or shoes to complete this
          outfit.
        </p>
      )}
      <div className="look-footer">
        <div>
          <span>New pieces total</span>
          <strong>{money(outfit.total)}</strong>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onTryOn}
          disabled={!outfit.products.length}
        >
          <WandSparkles size={15} />
          See it on me
        </Button>
        <Button size="sm" onClick={onSelect}>
          Outfit details <ChevronRight size={15} />
        </Button>
      </div>
      <details className="availability-details">
        <summary>
          <MapPin size={14} />
          Stores, locations & delivery <ChevronDown size={14} />
        </summary>
        {outfit.products.map((p) => (
          <div key={p.id}>
            <strong>{p.name}</strong>
            <p>
              {p.store?.name} · Size {p.availability?.size} ·{" "}
              {p.availability?.quantity} available
              {p.sample ? " (sample stock)" : ""}
            </p>
            {p.availability?.aisle && (
              <p>
                Aisle {p.availability.aisle}
                {p.availability.rack ? " · Rack " + p.availability.rack : ""}
              </p>
            )}
            <p>
              {p.delivery.length
                ? p.delivery.join(" · ")
                : "Delivery details not supplied by retailer."}
            </p>
          </div>
        ))}
      </details>
    </article>
  );
}
