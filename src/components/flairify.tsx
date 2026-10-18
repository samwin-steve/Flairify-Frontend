"use client";
import { Skeleton, LoadingDots } from "./ui/loading";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { WelcomeFairyCursor } from "./welcome-fairy-cursor";
import { StylistComposer } from "./stylist-composer";
import { VoiceConversation } from "./voice-conversation";
import { useVoiceStylist } from "@/lib/use-voice-stylist";
import {
  voiceHistory,
  voicePages,
  type VoiceDestination,
  type VoicePage,
} from "@/lib/voice-navigation";
import { streamChat } from "@/lib/chat-stream";
import { shoppingReady, selectedConversation } from "@/lib/shopping-session";
import { loadFirebaseConfig } from "@/lib/firebase-config";
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
  ChartNoAxesCombined,
  ArrowDown,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Clapperboard,
  Compass,
  Heart,
  ImagePlus,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Network,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  WandSparkles,
  X,
} from "lucide-react";
import { api, post, put, del, syncMediaSession } from "@/lib/api";
import { money } from "@/lib/utils";
import { lookPresentation } from "@/lib/look-presentation";
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
import { FittingRoom, PreviewCard } from "./fitting-room";
import { Admin } from "./admin";
import { Inventory } from "./inventory";
import { Analytics } from "./analytics";
import { Checkout, Orders } from "./checkout";
import { ShoppingBag, Store as SellerIcon } from "lucide-react";
const BehindTheScenes = dynamic(() => import("./behind-the-scenes"), {
  loading: () => <main className="page-content"><LoadingDots /> Loading the journey…</main>,
});
import {
  pieceKey,
  productPiece,
  wardrobePiece,
  togglePiece,
  selections,
  type PreviewPiece,
  type PreviewSelection,
} from "@/lib/try-on-selection";

const navigation = [
  { id: "stylist", label: "Stylist", icon: Sparkles },
  { id: "wardrobe", label: "My Wardrobe", icon: Shirt },
  { id: "inventory", label: "Inventory", icon: StoreIcon },
  { id: "saved", label: "Saved Looks", icon: Bookmark },
  { id: "fitting", label: "Fitting Room", icon: WandSparkles },
  { id: "orders", label: "My Orders", icon: ShoppingBag },
  { id: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { id: "behind-scenes", label: "Behind the scenes!", icon: Network },
  { id: "admin", label: "Seller Studio", icon: SellerIcon },
];
const prompts = [
  {
    icon: Compass,
    title: "Pack for a work trip",
    text: "Three days in Mumbai for work. I’ll be walking a lot. My budget is ₹5,000, and I want pieces I’ll wear again.",
    label: "Help me pack for Mumbai",
  },
  {
    icon: Shirt,
    title: "Find a versatile jacket",
    text: "Which jacket under ₹3,000 works with the most distinct outfits in my wardrobe?",
    label: "Find my most versatile jacket",
  },
  {
    icon: Heart,
    title: "An everyday look",
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

// Only entry and setup screens use this boundary. The main app mounts without it.
function welcomeScreen(content: ReactNode) {
  return <WelcomeFairyCursor>{content}</WelcomeFairyCursor>;
}

function Application() {
  const qc = useQueryClient();
  const [session, setSession] = useState(false);
  const [boot, setBoot] = useState(true);
  const [page, setPage] = useState("stylist");
  const [referenceTab, setReferenceTab] = useState(false);
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
  const chatController = useRef<AbortController | null>(null);
  const chatRetry = useRef<{ signature: string; key: string } | null>(null);
  const [streamStatus, setStreamStatus] = useState("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  useEffect(() => () => chatController.current?.abort(), []);
  const previewLock = useRef(false);
  const previewKeys = useRef(new Map<string, string>());
  const [checkout, setCheckout] = useState<{
    products: Product[];
    id?: string;
    previewJobId?: string;
  } | null>(null);
  const [refinementLook, setRefinementLook] = useState<Outfit | null>(null);
  const historyRestored = useRef(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [activeHistoryReady, setActiveHistoryReady] = useState(false);
  const [activeLook, setActiveLook] = useState<Outfit | null>(null);
  const [includeWardrobe, setIncludeWardrobe] = useState(false);
  const [toast, setToast] = useState("");
  const [addPhotos, setAddPhotos] = useState(false);
  const [filter, setFilter] = useState("all");
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceSelection, setVoiceSelection] = useState<PreviewPiece[] | null>(
    null,
  );
  const voiceTarget = useRef<string | null>(null);
  const voiceTrail = useRef<VoicePage[]>(["stylist"]);

  function navigateByVoice(destination: VoiceDestination) {
    if (!voiceTarget.current) return;
    voiceTrail.current = voiceHistory(voiceTrail.current, destination);
    const target = voiceTrail.current.at(-1)!;
    setPage(target);
    setReferenceTab(false);
    setMobileMenu(false);
    setDetails(false);
    setAddPhotos(false);
    setCheckout(null);
    setError("");
    setToast(voicePages[target]);
  }

  const voice = useVoiceStylist({
    onStart: (id) => {
      voiceTarget.current = id;
      setConvoId(id);
      localStorage.setItem("flairify-conversation", id);
    },
    onTranscript: (role, text) => {
      if (!voiceTarget.current) return;
      const id = "voice-draft-" + role;
      setMessages((old) => {
        const existing = old.find((m) => m.id === id);
        return existing
          ? old.map((m) => (m.id === id ? { ...m, content: text } : m))
          : [
              ...old,
              {
                id,
                role,
                content: text,
                outfits: [],
                source: "voice",
                created_at: new Date().toISOString(),
              },
            ];
      });
    },
    onOutfits: (outfits) => {
      if (!voiceTarget.current) return;
      if (outfits.length) setActiveLook(outfits[0]);
      setMessages((old) => {
        const id = "voice-draft-assistant";
        return old.some((m) => m.id === id)
          ? old.map((m) => (m.id === id ? { ...m, outfits } : m))
          : [
              ...old,
              {
                id,
                role: "assistant",
                content: "",
                outfits,
                source: "voice",
                created_at: new Date().toISOString(),
              },
            ];
      });
    },
    onSelection: (pieces, adjustments) => {
      if (!voiceTarget.current) return;
      setVoiceSelection(pieces);
      if (adjustments.length) setToast(adjustments.join(" "));
    },
    onPreview: () => {
      if (!voiceTarget.current) return;
      qc.invalidateQueries({ queryKey: ["jobs"] });
      navigateByVoice("fitting");
    },
    onNavigate: navigateByVoice,
    onTurn: (conversation) => {
      if (voiceTarget.current !== conversation.id) return;
      setMessages(conversation.messages);
      setVoiceSelection(conversation.voice_selection || []);
      setRefinementLook(null);
      qc.invalidateQueries({ queryKey: ["conversations"] });
      requestAnimationFrame(() =>
        bottom.current?.scrollIntoView({ behavior: "auto", block: "end" }),
      );
    },
    onEnd: (id) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      void api<{ conversations: Conversation[] }>("/conversations")
        .then((data) => {
          if (voiceTarget.current !== id) return;
          const conversation = data.conversations.find((c) => c.id === id);
          if (conversation) setMessages(conversation.messages);
        })
        .catch(() => {
          if (voiceTarget.current === id)
            setError(
              "Your voice chat ended. Refresh to reload its saved messages.",
            );
        });
    },
  });
  const bottom = useRef<HTMLDivElement>(null);
  const config = useQuery({
    // Guest capabilities must never overwrite restored account capabilities.
    queryKey: ["config", session ? "account" : "guest"],
    queryFn: ({ signal }) => api<Config>("/config", { signal }),
    enabled: !boot,
  });
  useEffect(() => {
    const existing = localStorage.getItem("flairify-token");
    syncMediaSession();
    setSession(!!existing);
    const url = new URL(window.location.href);
    setStoreId(url.searchParams.get("store") || "");
    let cancelled = false;
    let unsubscribe = () => {};
    const accountStorageChanged = (event: StorageEvent) => {
      if (event.key === "flairify-token" || event.key === null) syncMediaSession();
    };
    window.addEventListener("storage", accountStorageChanged);
    loadFirebaseConfig()
      .then(({ firebase }) => {
        if (cancelled) return;
        if (firebase.apiKey && firebase.appId) {
          if (!getApps().length) initializeApp(firebase);
          setFirebaseReady(true);
          unsubscribe = onAuthStateChanged(getAuth(), (user) => {
            if (cancelled) return;
            syncMediaSession();
            if (user) {
              setSession(true);
              qc.invalidateQueries();
            }
            setBoot(false);
          });
        } else setBoot(false);
      })
      .catch(() => {
        if (!cancelled) setBoot(false);
      });
    return () => {
      cancelled = true;
      window.removeEventListener("storage", accountStorageChanged);
      unsubscribe();
    };
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
  useEffect(() => {
    if (!session) {
      historyRestored.current = false;
      setActiveHistoryReady(false);
      return;
    }
    if (!conversations.data || historyRestored.current) return;
    historyRestored.current = true;
    const savedId = localStorage.getItem("flairify-conversation");
    const candidate = selectedConversation(
      conversations.data.conversations,
      savedId,
    );
    if (candidate) {
      setConvoId(candidate.id);
      setMessages(candidate.messages);
      setVoiceSelection(
        candidate.voice_selection?.length ? candidate.voice_selection : null,
      );
      localStorage.setItem("flairify-conversation", candidate.id);
    }
    setActiveHistoryReady(true);
  }, [session, conversations.data]);
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
    setIncludeWardrobe(profile.data?.include_wardrobe ?? false);
  }, [profile.data?.include_wardrobe]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const confirmed = wardrobe.data?.items.filter((w) => w.confirmed) || [];
  const ready = shoppingReady(profile.data);
  const needsSetup = session && !!profile.data && !ready;
  useEffect(() => {
    // Covers restored logins and older profiles with missing required sizes.
    // Render gating below prevents the chat appearing before this effect runs.
    if (needsSetup) setOnboarding(true);
  }, [needsSetup]);
  const latestOutfits =
    messages.filter((m) => m.role === "assistant" && m.outfits?.length).at(-1)
      ?.outfits || [];
  const summaryLook = activeLook || latestOutfits[0];
  function changePage(id: string) {
    // An in-app page change must not silently end the ongoing conversation.
    // Track manual navigation too, so a spoken "go back" returns to that page.
    if (voice.active && Object.hasOwn(voicePages, id)) {
      voiceTrail.current = voiceHistory(voiceTrail.current, id as VoicePage);
    }
    setPage(id);
    setReferenceTab(false);
    setMobileMenu(false);
    setError("");
  }
  function openChat(conversation?: Conversation) {
    // Detach callbacks before aborting so an old stream/call cannot reopen itself.
    voiceTarget.current = null;
    voice.stop();
    const controller = chatController.current;
    chatController.current = null;
    controller?.abort();
    chatRetry.current = null;
    historyRestored.current = true;
    setActiveHistoryReady(true);
    setBusy(false);
    setStreamStatus("");
    setStreamingMessageId(null);
    setConvoId(conversation?.id || null);
    localStorage.setItem("flairify-conversation", conversation?.id || "");
    setMessages(conversation?.messages || []);
    setVoiceSelection(
      conversation?.voice_selection?.length
        ? conversation.voice_selection
        : null,
    );
    setInput("");
    setRefinementLook(null);
    setActiveLook(null);
    setDetails(false);
    changePage("stylist");
    requestAnimationFrame(() => {
      document.querySelector(".conversation-scroll")?.scrollTo({ top: 0 });
      document
        .querySelector<HTMLTextAreaElement>(
          '[aria-label="Message your stylist"]',
        )
        ?.focus();
    });
  }
  function manageReferences() {
    changePage("fitting");
    setReferenceTab(true);
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
      syncMediaSession();
      qc.clear();
      setSession(true);
      openChat();
      setOnboarding(true);
    });
    setBusy(false);
  }
  async function login(google = false) {
    setBusy(true);
    await action(async () => {
      if (boot || !firebaseReady)
        throw new Error(
          "Sign-in is unavailable right now. You can browse as a guest.",
        );
      // Clear guest data before auth changes enable the account queries.
      // The auth listener and profile query handle both sign-in and restoration.
      qc.clear();
      if (google) await signInWithPopup(getAuth(), new GoogleAuthProvider());
      else if (register)
        await createUserWithEmailAndPassword(getAuth(), email, password);
      else await signInWithEmailAndPassword(getAuth(), email, password);
      localStorage.removeItem("flairify-token");
      syncMediaSession();
      openChat();
      setAuthOpen(false);
    });
    setBusy(false);
  }
  async function logout() {
    voiceTarget.current = null;
    voice.stop(false);
    if (getApps().length) await signOut(getAuth());
    localStorage.removeItem("flairify-token");
    syncMediaSession();
    sessionStorage.removeItem("flairify-sizes");
    sessionStorage.removeItem("flairify-department");
    setIncludeWardrobe(false);
    chatController.current?.abort();
    chatController.current = null;
    chatRetry.current = null;
    setBusy(false);
    setSession(false);
    setCheckout(null);
    previewKeys.current.clear();
    setOnboarding(false);
    setMessages([]);
    setVoiceSelection(null);
    setConvoId(null);
    setRefinementLook(null);
    localStorage.removeItem("flairify-conversation");
    qc.clear();
    setPage("stylist");
  }
  async function send(text = input) {
    if (
      !text.trim() ||
      busy ||
      voice.active ||
      chatController.current ||
      !activeHistoryReady
    )
      return;
    if (!ready) {
      setOnboarding(true);
      return;
    }
    setInput("");
    voiceTarget.current = null;
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
    requestAnimationFrame(() =>
      bottom.current?.scrollIntoView({ behavior: "auto", block: "end" }),
    );
    const controller = new AbortController();
    chatController.current = controller;
    setStreamStatus("Checking your saved shopping preferences…");
    const payload = {
      message: text,
      conversation_id: convoId,
      reference_outfit_id: refinementLook?.id || null,
      store_id: storeId || null,
      include_wardrobe: includeWardrobe,
    };
    const signature = JSON.stringify(payload);
    if (chatRetry.current?.signature !== signature)
      chatRetry.current = { signature, key: crypto.randomUUID() };
    const assistantId = draft.id + "-reply";
    setStreamingMessageId(assistantId);
    const updateReply = (update: (m: Message) => Message) => {
      if (chatController.current !== controller) return;
      setMessages((old) => {
        const existing = old.find((m) => m.id === assistantId);
        const reply = update(
          existing || {
            id: assistantId,
            role: "assistant",
            content: "",
            outfits: [],
            created_at: new Date().toISOString(),
          },
        );
        return existing
          ? old.map((m) => (m.id === assistantId ? reply : m))
          : [...old, reply];
      });
    };
    try {
      const result = await streamChat(
        { ...payload, request_id: chatRetry.current!.key },
        (event) => {
          if (chatController.current !== controller) return;
          if (event.type === "status") setStreamStatus(event.message);
          if (event.type === "text")
            updateReply((m) => ({ ...m, content: m.content + event.delta }));
          if (event.type === "outfits")
            updateReply((m) => ({ ...m, outfits: event.outfits }));
        },
        controller.signal,
      );
      if (chatController.current !== controller) return;
      setConvoId(result.conversation.id);
      localStorage.setItem("flairify-conversation", result.conversation.id);
      setRefinementLook(null);
      setMessages(result.conversation.messages);
      if (result.outfits.length) setActiveLook(result.outfits[0]);
      chatRetry.current = null;
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      if (chatController.current !== controller) return;
      setMessages((old) =>
        old.filter((m) => m.id !== draft.id && m.id !== assistantId),
      );
      setInput(text);
      setError((e as Error).message);
    } finally {
      if (chatController.current === controller) {
        chatController.current = null;
        setBusy(false);
        setStreamStatus("");
        setStreamingMessageId(null);
        // Keep the answer visible; scrolling to the last card hides the new reply.
        setTimeout(() => {
          const replies = document.querySelectorAll(".message.assistant");
          replies
            .item(replies.length - 1)
            ?.scrollIntoView({ behavior: "auto", block: "start" });
        }, 80);
      }
    }
  }

  function startVoice() {
    if (voice.active) return;
    if (!ready) {
      setOnboarding(true);
      return;
    }
    if (profile.data?.demo) {
      void signInForPreview();
      return;
    }
    setError("");
    voiceTrail.current = [
      Object.hasOwn(voicePages, page) ? (page as VoicePage) : "stylist",
    ];
    // The authenticated ticket endpoint checks current availability. A pending
    // or stale capability response must not block a valid signed-in customer.
    void voice.start({
      conversation_id: convoId,
      reference_outfit_id: refinementLook?.id || null,
      include_wardrobe: includeWardrobe,
      store_id: storeId || null,
    });
  }

  async function saveLook(outfit: Outfit) {
    await action(async () => {
      await post("/saved/" + outfit.id);
      qc.invalidateQueries({ queryKey: ["saved"] });
      setToast("A good look, saved for later.");
    });
  }
  async function requestTryOn(
    selected: PreviewSelection[],
    outfitId?: string,
    messageId?: string,
    background?: boolean,
  ) {
    if (!selected.length) throw new Error("Select at least one garment first.");
    if (profile.data?.demo)
      throw new Error("Sign in to create a preview with your photo.");
    if (!profile.data?.consent.ai_photo_processing)
      throw new Error(
        "Allow Google AI photo processing in Profile before generating your preview.",
      );
    if (!config.data?.try_on)
      throw new Error(
        "Google image generation is unavailable in this environment.",
      );
    if (previewLock.current)
      throw new Error("Your preview request is already being sent.");
    previewLock.current = true;
    const chatMessage = page === "stylist"
      ? messageId || [...messages].reverse().find((m) => m.role === "assistant")?.id
      : undefined;
    const chatId = chatMessage ? convoId : null;
    const fingerprint = JSON.stringify([
      chatId,
      chatMessage,
      outfitId,
      selected,
      background ?? profile.data?.keep_background,
    ]);
    const key = previewKeys.current.get(fingerprint) || crypto.randomUUID();
    previewKeys.current.set(fingerprint, key);
    try {
      if (background !== undefined && background !== !!profile.data?.keep_background) {
        const { admin, demo, seller, ...data } = profile.data!;
        const savedProfile = await put<Profile>("/profile", {
          ...data,
          keep_background: background,
        });
        qc.setQueryData(["profile"], { ...profile.data, ...savedProfile });
      }
      const job = await post<Job>("/generate/try_on", {
        selections: selected,
        conversation_id: chatId,
        message_id: chatId ? chatMessage : undefined,
        outfit_id: outfitId,
        request_key: key,
      });
      previewKeys.current.delete(fingerprint);
      qc.setQueryData<{ jobs: Job[] }>(["jobs"], (old) => ({
        jobs: [job, ...(old?.jobs || []).filter((j) => j.id !== job.id)],
      }));
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      if (!chatId) changePage("fitting");
      else requestAnimationFrame(() =>
        document.getElementById("preview-" + job.id)?.scrollIntoView({ block: "nearest", behavior: "auto" }),
      );
    } finally {
      previewLock.current = false;
    }
  }
  async function signInForPreview() {
    await logout();
    setRegister(true);
    setAuthOpen(true);
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

  if (session && (boot || profile.isPending))
    return welcomeScreen(
      <div className="loading-page">
        <div className="wordmark">
          flairify<span>✧</span>
        </div>
        <LoaderCircle className="spin" />
        <p role="status">Getting your space ready…</p>
      </div>
    );
  if (session && profile.isError)
    return welcomeScreen(
      <main className="loading-page">
        <h1>Let’s reconnect.</h1>
        <p role="alert">We couldn’t load your shopping preferences.</p>
        <Button onClick={() => profile.refetch()}>Try again</Button>
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </main>
    );
  if (session && (needsSetup || onboarding) && !config.data)
    return welcomeScreen(
      <main className="loading-page">
        <p role="status">Getting your account setup ready…</p>
        {config.isError && (
          <Button onClick={() => config.refetch()}>Try again</Button>
        )}
      </main>
    );
  if (session && (needsSetup || onboarding) && profile.data && config.data)
    return welcomeScreen(
      <Onboarding
        profile={profile.data}
        config={config.data}
        onSignOut={logout}
        onExit={() => {
          setOnboarding(false);
          setPage("inventory");
        }}
        onComplete={() => {
          setOnboarding(false);
          refresh();
          setToast(
            confirmed.length
              ? "Your wardrobe is ready."
              : "Your shopping preferences are ready.",
          );
        }}
      />
    );
  if (!session)
    return welcomeScreen(
      <div className="landing">
        <header className="landing-nav">
          <div className="wordmark">
            flairify<span>✧</span>
          </div>
          <nav>
            <Button variant="ghost" onClick={() => setAuthOpen(true)}>
              Sign in <ArrowRight size={15} />
            </Button>
          </nav>
        </header>
        <main>
          <div className="landing-hero">
            <div className="landing-copy">
              <h1>
                A wardrobe that feels
                <br />
                <em>like you.</em>
              </h1>
              <p>
                Consider us your fitting-room friend. We’ll find pieces you’ll
                love, show you wearing them, and keep your budget in mind.
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
                  disabled={busy || boot || (!firebaseReady && config.isPending)}
                >
                  {busy ? <LoadingDots /> : null}
                  Find my look <ArrowRight size={18} />
                </Button>
              </div>
              <div className="landing-principles">
                <span>
                  <ShieldCheck size={18} />
                  Privacy first
                </span>
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </div>
            <div className="landing-visual">
              <Image
                className="hero-photo"
                src="/images/hero.jpg"
                alt="Editorial style inspiration: a woman wearing a light blazer"
                width={1200}
                height={1677}
                sizes="(max-width: 760px) 90vw, 560px"
                preload
              />
              <div className="floating-look">
                <Image src="/images/blazer.jpg" alt="Beige blazer" width={720} height={1008} sizes="100px" />
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
            </div>
          </div>
          <section className="how-it-works" id="how-it-works">
            <div>
              <h2>Find an outfit</h2>
            </div>
            {[
              {
                n: "01",
                title: "Tell us what you need",
                text: "An occasion, a style, a budget. Add pieces you already own if you’d like.",
              },
              {
                n: "02",
                title: "See yourself in it",
                text: "Explore personalised recommendations and preview yourself wearing the look with AI.",
              },
              {
                n: "03",
                title: "Find it and make it yours",
                text: "Check your size and availability. Get help finding it in store, or explore nearby stores and online options.",
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
          <a href="/image-credits.json" target="_blank">
            Photo credits
          </a>
        </footer>
        {authOpen && (
          <Modal
            open
            onOpenChange={setAuthOpen}
            title={register ? "Welcome!" : "Welcome back."}
            description={null}
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
                disabled={busy || boot || !firebaseReady}
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
              <Button disabled={busy || boot || !firebaseReady}>
                {register ? "Create account" : "Sign in"}
              </Button>
              <button
                type="button"
                className="text-link"
                onClick={() => setRegister(!register)}
              >
                {register ? "Already have an account?" : "Create an account"}
              </button>
              {boot && <p role="status">Getting sign-in ready…</p>}
              {!boot && !firebaseReady && (
                <div className="notice">
                  <p>
                    Sign-in is unavailable right now. You can browse as a guest.
                  </p>
                  <Button type="button" onClick={startDemo}>
                    Browse as guest
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
      <div className="history">
        <div className="section-line">
          <span>YOUR CHATS</span>
          <button
            className="icon-button small"
            onClick={() => openChat()}
            aria-label="New chat"
          >
            <Plus size={16} />
          </button>
        </div>
        {conversations.data?.conversations
          .slice(0, showAllHistory ? undefined : 5)
          .map((c) => (
            <button
              className={convoId === c.id ? "selected" : ""}
              key={c.id}
              onClick={() => openChat(c)}
            >
              <MessageCircle size={15} />
              <span>{c.title}</span>
            </button>
          ))}
        {(conversations.data?.conversations.length || 0) > 5 && (
          <button
            className="text-link"
            onClick={() => setShowAllHistory(!showAllHistory)}
          >
            {showAllHistory ? "Show less" : "All conversations"}
          </button>
        )}
        {!conversations.data?.conversations.length && (
          <p>Your conversations appear here.</p>
        )}
      </div>
      <div className="sidebar-bottom">
        <button
          className="account-button"
          onClick={() => changePage("profile")}
        >
          <span className="avatar">{profile.data?.name?.[0] || "Y"}</span>
          <div>
            <strong>{profile.data?.name || "Your space"}</strong>
            <small>Profile & settings</small>
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
      </div>
      <div className="section-line">
        <strong>From your wardrobe</strong>
        <span className="pill">Owned</span>
      </div>
      <div className="wardrobe-mini-grid">
        {(summaryLook?.owned || confirmed).slice(0, 4).map((w) => (
          <div key={w.id} className="mini-garment">
            <Media src={w.generated_image || w.image} alt={w.name} />
            <strong>{w.name}</strong>
            <small>
              {w.colour}
              {w.generated_image ? " · AI-generated image" : ""}
            </small>
          </div>
        ))}
      </div>
      {!confirmed.length && (
        <div className="mini-empty">
          <Shirt size={28} />
          <p>No wardrobe pieces yet.</p>
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
            <strong>Selected pieces</strong>
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
          </div>
        </>
      )}
      <div className="store-note">
        <MapPin size={18} />
        <div>
          <strong>Your store</strong>
          <p>
            {stores.data?.stores.find(
              (s) => s.id === (storeId || profile.data?.preferred_store_id),
            )?.name || "All available stores"}
          </p>
          <button className="text-link" onClick={() => changePage("profile")}>
            Change in Profile
          </button>
          <button className="text-link" onClick={nearby}>
            Find stores near me
          </button>
          {stores.data?.stores
            .filter((s) => !s.sample && s.distance_km !== undefined)
            .map((s) => (
              <p className="fine-print" key={s.id}>
                {s.name}: {s.distance_km} km
                <br />
                {s.distance_label}
              </p>
            ))}
        </div>
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
              {page === "profile"
                ? "Profile"
                : navigation.find((n) => n.id === page)?.label || "Seller Studio"}
            </span>
          </div>
          <div className="header-actions">
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
        {voice.finishing && <div className="notice" role="status"><LoadingDots /> Call ended. Finishing your request and saving the chat…</div>}
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
            <main
              className={
                "conversation refined-chat" +
                (busy ? " is-answering" : "") +
                (!messages.length ? " is-empty" : "")
              }
            >
              <div className="stylist-aura" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="chat-actions">
                <button
                  className="chat-history-button mobile-only"
                  onClick={() => setMobileMenu(true)}
                >
                  <MessageCircle size={17} /> Your chats
                </button>
                <button className="new-chat-button" onClick={() => openChat()}>
                  <Plus size={17} /> New chat
                </button>
              </div>
              <div className="conversation-scroll">
                {conversations.isError && (
                  <div className="notice error" role="alert">
                    Your conversations couldn’t be loaded.{" "}
                    <button
                      className="text-link"
                      onClick={() => conversations.refetch()}
                    >
                      Try again
                    </button>
                  </div>
                )}
                {!messages.length ? (
                  <>
                    <div className="stylist-intro">
                      <span className="stylist-mark" aria-hidden="true">
                        <Sparkles size={26} />
                      </span>
                      <h1>
                        Hi{" "}
                        {profile.data?.name && profile.data.name !== "Friend"
                          ? profile.data.name.split(" ")[0]
                          : "there"}
                        .<br />
                        What feels like <em>you</em> today?
                      </h1>
                      <p>
                        Tell me your plans. We’ll find your look, then make it
                        yours.
                      </p>
                    </div>
                    <div className="agenda-cards">
                      {prompts.map((p) => (
                        <button
                          className="agenda-card"
                          aria-label={p.label}
                          disabled={busy || !activeHistoryReady}
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
                            <span className="assistant-label">Flairify</span>
                          )}
                          <p
                            className={
                              m.id === streamingMessageId
                                ? "streaming-copy"
                                : undefined
                            }
                            aria-busy={m.id === streamingMessageId}
                          >
                            {m.id === streamingMessageId
                              ? m.content.split(/(\s+)/).map((word, index) =>
                                  /\S/.test(word) ? (
                                    <span className="stream-word" key={index}>
                                      {word}
                                    </span>
                                  ) : (
                                    word
                                  ),
                                )
                              : m.content}
                          </p>
                          {m.source === "voice" && (
                            <span className="voice-message-label">
                              Voice {m.interrupted ? "· Interrupted" : ""}
                            </span>
                          )}
                          {(m.id === streamingMessageId ? [] : m.outfits)?.map(
                            (o, i) => (
                              <LookCard
                                key={o.id}
                                outfit={o}
                                voiceSelection={voiceSelection}
                                onVoiceSelection={(pieces) => {
                                  if (voice.active) voice.select(pieces);
                                  else setVoiceSelection(pieces);
                                }}
                                index={i}
                                isSaved={
                                  !!saved.data?.looks.some((s) => s.id === o.id)
                                }
                                onSave={() => saveLook(o)}
                                onTryOn={(selected, background) =>
                                  requestTryOn(selected, o.id, m.id, background)
                                }
                                keepBackground={!!profile.data?.keep_background}
                                onSetup={() => changePage("profile")}
                                onReference={manageReferences}
                                onSignIn={
                                  profile.data?.demo
                                    ? signInForPreview
                                    : undefined
                                }
                                onBuy={() => setCheckout(o)}
                                onRefine={() => {
                                  setRefinementLook(o);
                                  setInput("");
                                }}
                                onSelect={() => {
                                  setActiveLook(o);
                                  setDetails(true);
                                }}
                              />
                            ),
                          )}
                          {jobs.data?.jobs.filter((j) =>
                            j.kind === "try_on" && j.status !== "cancelled" &&
                            (j.id === m.preview_job_id ||
                              (j.conversation_id === convoId && j.message_id === m.id)),
                          ).slice().reverse().map((j) => (
                            <PreviewCard key={j.id} job={j} compact
                              onBuy={(products, previewJobId) => setCheckout({ products, previewJobId })}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {busy && (
                      <div
                        className="thinking"
                        role="status"
                        aria-live="polite"
                      >
                        <span className="stylist-avatar">✧</span>
                        <LoadingDots />
                        {streamStatus ||
                          "Finding outfits…"}
                      </div>
                    )}
                    <div ref={bottom} />
                  </div>
                )}
              </div>
              <div className="composer-area">
                {!!voiceSelection?.length && (
                  <div
                    className="voice-selection"
                    aria-label="Selected for your preview"
                  >
                    <span>
                      <strong>Your preview</strong> ·{" "}
                      {voiceSelection.map((p) => p.name).join(" + ")}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() =>
                        action(() => requestTryOn(selections(voiceSelection)))
                      }
                    >
                      <WandSparkles size={16} /> See it on me
                    </Button>
                  </div>
                )}
                {messages.length > 0 && !busy && !voice.active && (
                  <div className="followup-chips">
                    {[
                      "Why does this work?",
                      "A different variation",
                      "Something cheaper",
                      "More relaxed",
                    ].map((t) => (
                      <button key={t} onClick={() => send(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {voice.error && (
                  <div className="voice-notice" role="alert">
                    {voice.error}
                    <button
                      onClick={voice.clearError}
                      aria-label="Dismiss voice message"
                    >
                      ×
                    </button>
                  </div>
                )}
                {voice.active ? (
                  <VoiceConversation
                    phase={voice.phase}
                    activity={voice.activity || (jobs.data?.jobs.some((j) => j.id === voice.previewJobId && ["queued", "running"].includes(j.status)) ? "Creating your preview…" : "")}
                    muted={voice.muted}
                    speaking={voice.speaking}
                    seconds={voice.seconds}
                    onMute={voice.toggleMute}
                    onEnd={() => voice.stop()}
                  />
                ) : (
                  <StylistComposer
                    input={input}
                    onInput={setInput}
                    onSend={() => send()}
                    busy={busy || voice.finishing || !activeHistoryReady}
                    ready={ready}
                    includeWardrobe={includeWardrobe}
                    onWardrobe={setIncludeWardrobe}
                    onPhotos={() =>
                      ready ? setAddPhotos(true) : setOnboarding(true)
                    }
                    onSettings={() => changePage("profile")}
                    focus={refinementLook}
                    onClearFocus={() => setRefinementLook(null)}
                    onTalk={startVoice}
                  />
                )}
              </div>
            </main>
            <aside className="outfit-details">{detailsPanel}</aside>
          </div>
        )}
        {page === "wardrobe" && (
          <main className="page-content">
            <div className="section-line">
              <Button onClick={() => setAddPhotos(true)} size="sm">
                <Plus size={16} />
                Add photos
              </Button>
            </div>
            <h1>My wardrobe</h1>
            <p className="page-subtitle">{confirmed.length} confirmed pieces</p>
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
                  <LoadingDots />
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
            {wardrobe.isLoading && <Skeleton label="Loading wardrobe" cards={6} />}
            {!wardrobe.isLoading && !wardrobe.data?.items.length && (
              <div className="empty-state">
                <Shirt size={32} />
                <h2>Your wardrobe is empty</h2>
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
            <h1>Saved looks</h1>
            {saved.isLoading ? <Skeleton label="Loading saved looks" cards={3} /> : !saved.data?.looks.length ? (
              <div className="empty-state">
                <Bookmark size={32} />
                <h2>No saved looks yet</h2>
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
                      onTryOn={(selected, background) =>
                        requestTryOn(selected, s.outfit.id, undefined, background)
                      }
                      keepBackground={!!profile.data?.keep_background}
                      onSetup={() => changePage("profile")}
                      onReference={manageReferences}
                      onSignIn={
                        profile.data?.demo ? signInForPreview : undefined
                      }
                      onBuy={() => setCheckout(s.outfit)}
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
          <Inventory
            onTryOn={(p) => requestTryOn(selections([productPiece(p)]))}
            onSetup={() => changePage("profile")}
            onReference={manageReferences}
            onSignIn={profile.data?.demo ? signInForPreview : undefined}
            onBuy={(p) => setCheckout({ products: [p] })}
            onSell={() => changePage("admin")}
          />
        )}
        {page === "analytics" && <Analytics />}
        {page === "behind-scenes" && <BehindTheScenes />}
        {page === "orders" && <Orders onShop={() => changePage("inventory")} />}
        {page === "fitting" && (
          <FittingRoom
            onBuy={(products, previewJobId) =>
              setCheckout({ products, previewJobId })
            }
            key={referenceTab ? "references" : "previews"}
            showReferences={referenceTab}
            onShop={() => changePage("inventory")}
            onWardrobe={() => changePage("wardrobe")}
          />
        )}
        {page === "profile" && profile.data && (
          <main className="page-content">
            <h1>Profile & preferences</h1>
            <div className="profile-columns">
              <div className="white-panel">
                <ProfileForm
                  profile={profile.data}
                  onSaved={() => {
                    setToast("Your preferences are updated.");
                  }}
                />
              </div>
              <div>
                <div className="white-panel">
                  <h3>Your photos</h3>
                  <Button variant="outline" onClick={manageReferences}>
                    Manage reference photos
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => changePage("wardrobe")}
                  >
                    Manage wardrobe and photos
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => changePage("admin")}>
                  <StoreIcon size={17} />
                  Seller Studio
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
        {page === "admin" && profile.data && (
          <Admin profile={profile.data} demoAdmin={!!config.data?.demo_admin} />
        )}
        {page !== "stylist" && voice.error && (
          <div className="voice-notice" role="alert">
            {voice.error}
            <button
              className="icon-button"
              onClick={voice.clearError}
              aria-label="Dismiss voice message"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {page !== "stylist" && voice.active && (
          <div className="voice-floating">
            <VoiceConversation
              phase={voice.phase}
                    activity={voice.activity || (jobs.data?.jobs.some((j) => j.id === voice.previewJobId && ["queued", "running"].includes(j.status)) ? "Creating your preview…" : "")}
              muted={voice.muted}
              speaking={voice.speaking}
              seconds={voice.seconds}
              onMute={voice.toggleMute}
              onEnd={() => voice.stop()}
            />
          </div>
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {mobileMenu && (
        <Modal open onOpenChange={setMobileMenu} title="Your Flairify">
          <div className="mobile-sidebar">{nav}</div>
        </Modal>
      )}
      {details && (
        <Modal open onOpenChange={setDetails} title="Your outfit notebook">
          <div className="drawer-details">{detailsPanel}</div>
        </Modal>
      )}
      {checkout && (
        <Checkout
          products={checkout.products}
          outfitId={checkout.id}
          previewJobId={checkout.previewJobId}
          onClose={() => setCheckout(null)}
          onPlaced={() => {
            setCheckout(null);
            changePage("orders");
            setToast("Order placed.");
          }}
        />
      )}
      {addPhotos && config.data && (
        <Modal
          open
          onOpenChange={setAddPhotos}
          wide
          title="Add wardrobe photos"
          description={null}
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
  onBuy,
  onSelect,
  onRefine,
  keepBackground,
  onSetup,
  onReference,
  onSignIn,
  voiceSelection,
  onVoiceSelection,
}: {
  outfit: Outfit;
  voiceSelection?: PreviewPiece[] | null;
  onVoiceSelection?: (pieces: PreviewPiece[]) => void;
  index: number;
  isSaved: boolean;
  onSave: () => void;
  onTryOn: (selected: PreviewSelection[], background: boolean) => Promise<void>;
  onBuy: () => void;
  onSelect: () => void;
  onRefine?: () => void;
  keepBackground: boolean;
  onSetup: () => void;
  onReference: () => void;
  onSignIn?: () => void;
}) {
  const [localSelected, setLocalSelected] = useState<PreviewPiece[]>([]);
  const allSelected = voiceSelection ?? localSelected;
  const selected = allSelected.filter((p) =>
    (p.kind === "product" ? outfit.products : outfit.owned).some(
      (item) => item.id === p.id,
    ),
  );
  const [notice, setNotice] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBackground, setPreviewBackground] = useState(keepBackground);
  const presentation = lookPresentation(outfit);
  const pieces = [
    ...outfit.owned.map(wardrobePiece),
    ...outfit.products.map(productPiece),
  ];
  const lock = useRef(false);
  function toggle(piece: PreviewPiece) {
    const next = togglePiece(allSelected, piece);
    if (voiceSelection != null && onVoiceSelection)
      onVoiceSelection(next.selected);
    else setLocalSelected(next.selected);
    setPreviewError("");
    setNotice(
      next.removed.length
        ? `${piece.name} replaces ${next.removed.map((p) => p.name).join(" and ")}. One piece per clothing slot.`
        : "",
    );
  }
  async function generate() {
    if (lock.current || !selected.length) return;
    lock.current = true;
    setGenerating(true);
    setPreviewError("");
    try {
      await onTryOn(selections(selected), previewBackground);
      setPreviewOpen(false);
    } catch (e) {
      setPreviewError((e as Error).message);
    } finally {
      setGenerating(false);
      lock.current = false;
    }
  }
  function checkbox(piece: PreviewPiece) {
    return (
      <label className="piece-select">
        <input
          type="checkbox"
          checked={selected.some((p) => pieceKey(p) === pieceKey(piece))}
          disabled={generating || !piece.available}
          onChange={() => toggle(piece)}
          aria-label={`Try on ${piece.name}`}
        />
        <span>{piece.name}</span>
        {!piece.available && <small>Unavailable</small>}
      </label>
    );
  }
  return (
    <article className="look-card">
      <div className="look-heading">
        <div>
          <span className="eyebrow">
            LOOK {String(index + 1).padStart(2, "0")} ·{" "}
            {outfit.occasion.toUpperCase()}
          </span>
          <h3>{presentation.title}</h3>
        </div>
        <div className="look-heading-actions">
          <button
            className={"icon-button " + (isSaved ? "saved" : "")}
            aria-label={isSaved ? "Remove saved look" : "Save look"}
            onClick={onSave}
          >
            <Bookmark size={20} fill={isSaved ? "currentColor" : "none"} />
          </button>
          <details className="look-options">
            <summary className="icon-button" aria-label="More look options">
              <Ellipsis size={20} />
            </summary>
            <div>
              <button onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                onSelect();
              }}>Outfit details</button>
              {onRefine && (
                <button onClick={(e) => {
                  e.currentTarget.closest("details")?.removeAttribute("open");
                  onRefine();
                }}>Refine this look</button>
              )}
            </div>
          </details>
        </div>
      </div>
      <div className="look-pieces">
        {outfit.owned.map((w) => (
          <div className="look-piece" key={w.id}>
            <div className="look-image">
              <Media src={w.generated_image || w.image} alt={w.name} />
              <span className="piece-label owned">Owned</span>
            </div>
            <strong>{w.name}</strong>
            <span>
              Already yours{w.generated_image ? " · AI-generated image" : ""}
            </span>
          </div>
        ))}
        {outfit.products.map((p) => (
          <div className="look-piece" key={p.id}>
            <div className="look-image">
              <Media src={p.image} alt={p.name} catalog />
              <span className="piece-label">New</span>
            </div>
            <strong>{p.name}</strong>
            <span>
              <b>{money(p.price)}</b>
              {p.availability?.size && <span>Size {p.availability.size}</span>}
            </span>
          </div>
        ))}
      </div>
      <p className="look-styling">{presentation.styling}</p>
      <fieldset className="look-preview-selection">
        <legend>
          Preview pieces{selected.length ? ` · ${selected.length} selected` : ""}
        </legend>
        <div>
          {pieces.map((piece) => <span key={pieceKey(piece)}>{checkbox(piece)}</span>)}
        </div>
      </fieldset>
      {notice && <p role="status">{notice}</p>}
      {outfit.graph_evidence?.status === "ready" &&
        Object.values(outfit.graph_evidence.counts).some(
          (count) => count > 0,
        ) && (
          <details className="wardrobe-connections">
            <summary>Connections in your wardrobe</summary>
            {outfit.products
              .filter(
                (product) =>
                  (outfit.graph_evidence?.counts[product.id] || 0) > 0,
              )
              .map((product) => (
                <p key={product.id}>
                  {product.name} appears in{" "}
                  {outfit.graph_evidence!.counts[product.id]} distinct
                  previously checked{" "}
                  {outfit.graph_evidence!.counts[product.id] === 1
                    ? "outfit"
                    : "outfits"}{" "}
                  for this occasion.
                </p>
              ))}
          </details>
        )}
      <div className="look-footer">
        <div>
          <span>New pieces total</span>
          <strong>{money(outfit.total)}</strong>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setPreviewBackground(keepBackground);
            setPreviewError("");
            setPreviewOpen(true);
          }}
          disabled={!selected.length || generating}
        >
          {generating ? (
            <LoadingDots />
          ) : (
            <WandSparkles size={15} />
          )}
          {generating ? "Starting preview…" : "See it on me"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onBuy}
          disabled={!outfit.products.length}
        >
          <ShoppingBag size={15} />
          Shop {outfit.products.length} {outfit.products.length === 1 ? "item" : "items"}
        </Button>
      </div>
      <details className="availability-details">
        <summary>
          <MapPin size={14} />
          Stores, locations & delivery <ChevronDown size={14} />
        </summary>
        {!outfit.products.length && <p>All pieces are already in your wardrobe.</p>}
        {outfit.products.map((p) => (
          <div key={p.id} className="look-store">
            <div className="look-store-heading">
              <strong>{p.name}</strong>
              <span className={"look-stock " + ((p.availability?.quantity || 0) > 0 && p.active !== false ? "in-stock" : "")}>
                {(p.availability?.quantity || 0) > 0 && p.active !== false ? "Available" : "Unavailable"}
              </span>
            </div>
            <p>
              {p.store?.name || "Store details unavailable"}
              {p.availability?.size && ` · Size ${p.availability.size}`}
            </p>
            {p.store?.address && <p>{p.store.address}</p>}
            {!p.sample && p.availability?.aisle && (
              <p>
                Aisle {p.availability.aisle}
                {p.availability.rack ? " · Rack " + p.availability.rack : ""}
              </p>
            )}
            {!!p.delivery.length && <p>{p.delivery.join(" · ")}</p>}
          </div>
        ))}
      </details>
      {previewOpen && (
        <Modal
          open
          onOpenChange={(open) => { if (!generating) setPreviewOpen(open); }}
          title="See it on me"
          description="Your selected pieces, together in one preview."
        >
          <ul className="preview-piece-list">
            {selected.map((p) => <li key={pieceKey(p)}>{p.name}</li>)}
          </ul>
          <label className="check-line background-preference">
            <input type="checkbox" checked={previewBackground} disabled={generating}
              onChange={(e) => setPreviewBackground(e.target.checked)} />
            Keep my photo’s background
          </label>
          <p className="fine-print">Unchecked uses a plain white background. This choice is remembered for future previews.</p>
          {previewError && (
            <div className="notice">
              <p role="alert" className="error">{previewError}</p>
              <div className="button-row">
                {onSignIn ? <Button size="sm" onClick={onSignIn}>Sign in to try on</Button> : (
                  <>
                    <Button size="sm" variant="outline" onClick={onReference}>Manage reference photos</Button>
                    <Button size="sm" variant="outline" onClick={onSetup}>Open Profile settings</Button>
                  </>
                )}
              </div>
            </div>
          )}
          <Button onClick={generate} disabled={generating || !selected.length}>
            {generating && <LoadingDots />}
            {generating ? "Starting preview…" : "Create preview"}
          </Button>
        </Modal>
      )}
    </article>
  );
}
