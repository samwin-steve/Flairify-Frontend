# Flairify frontend

[Open the deployed Flairify app](https://flairify-web-7kxckvikva-uc.a.run.app) · [API documentation](https://flairify-api-7kxckvikva-uc.a.run.app/docs)
A responsive Next.js web app for personalized shopping with optional wardrobe pairing. Light pink identity, original design, accessible Radix dialogs, TanStack Query, React Hook Form/Zod, Firebase client authentication and model-viewer.

**Share your wardrobe once. Find pieces that work with your life—and see the look on you.**

## Local setup

Requires Node.js 24.12 or newer. Package versions and transitive dependencies are locked.

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Start the [FastAPI backend](https://github.com/samwin-steve/Flairify-Backend) on port 8000, then open [localhost:3000](http://localhost:3000). Next.js proxies authenticated HTTP API and private media requests. Optional native voice connects directly to the backend's configured public WSS origin using a short-lived, single-use ticket; Google credentials never enter the browser.

No credentials are needed in demo mode. Choose **Browse as guest**, save department, clothing/shoe sizes, store and budget, then start shopping without photos. Optionally add photos or the sample wardrobe, review and confirm garments, and enable “Pair with my wardrobe” in chat. Mumbai recommendations check the combined cost of new pieces against ₹5,000. The customer interface omits demo badges and implementation notes; fixture provenance and capability boundaries remain in repository documentation and internal data.

## Your photo to a new look

Create an account or sign in, save your shopping preferences, allow Google photo processing, and upload a clear full-body photo. Flairify automatically extracts visible garments for ownership review. Once confirmed, browse Inventory, choose a photographed clothing item, and select **Try this on**. Existing wardrobe photos also work as preview references. The Fitting Room shows the Google-generated 2D preview, with download, regenerate and delete controls; original photos are managed in its Reference photos tab.

Anonymous sample mode does not call paid models. Sample catalogue prices, sizes and stock are simulated; seller listings retain supplied facts. The active image model is Google Gemini on Vertex AI; previews are style visualizations, not exact fit predictions.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
# With frontend and backend running:
npm run test:e2e
```

Playwright covers desktop and mobile onboarding, saved looks, inventory search, sign-in-required generation, refresh persistence, keyboard focus, contrast and overflow. Physical-device AR needs separate testing. Builds use Next.js's supported webpack path after a local Turbopack process-binding failure.

## Cloud Run

`Dockerfile` produces a non-root standalone Next.js image. `cloudbuild.yaml` tests, builds, pushes to Artifact Registry and deploys `flairify-web` in `data-workshops/us-central1`. The `flairify-frontend-main` Cloud Build trigger watches this repository's `main` branch. It discovers the backend service URL at deployment. Minimum instances 0, maximum 2.

Set runtime Firebase identifiers to enable production sign-in; Google Photos requires a separate OAuth client configured on the backend. Account sign-in never grants photo access.

## Media and licenses

Downloaded clothing/editorial images are stored locally in `public/images`; source pages, authors and Unsplash/Pexels/Kaggle dataset license links are recorded in [image-credits.json](public/image-credits.json). They are illustrative sample media, not merchandise offered by the depicted brands. Original fallback garment illustrations and the sample 3D mannequin are CC0. The mannequin does not represent any customer. No generative paid service outside Google Cloud is required.

[Backend documentation](https://github.com/samwin-steve/Flairify-Backend/tree/main/docs) includes architecture, integration setup, limitations, 3D research, deployment, evaluation, demo script and submission material.

## Seller Studio and shopping

- **Seller Studio** is available in the desktop navigation and mobile navigation drawer. Approved sellers add a photo, price, sizes, and stock through **Add clothes**. Owners can approve access requests. Shared inventory edits require a verified owner or seller role; the deployed anonymous demo cannot unlock them.
- **Inventory → Buy** works without photos, wardrobe onboarding or chat. New users save shopping preferences as part of account setup, then can choose **Browse clothes first**. Wardrobe pairing is optional.
- **Buy** on a stylist look uses the same reviewed checkout. Only new products are included in the displayed total; owned pieces are excluded.
- **My Orders** shows persisted order snapshots after refresh. Checkout requires confirmation of the items, sizes and quantities and states that no payment is required. Sellers see their listed items in **Orders received**. Orders are saved without payment, shipping, stock reservation or stock decrement.
- Customer product cards show product names, prices, sizes and purchase actions. New seller listings are shown once their backend indexing job succeeds. Adding a listing makes it eligible for matching recommendations; it does not guarantee inclusion in every look.

Local browser verification covers direct checkout after shopping setup without photos, a stylist checkout, order persistence, photographed seller listings, stock updates, desktop/mobile overflow, and accessibility scans of the new dialogs. Run the backend with `ENABLE_DEMO_ADMIN=true` and `DEMO_ADMIN_KEY=test-admin-key` for the local seller test. The seller test is skipped when `PLAYWRIGHT_BASE_URL` points at a deployment because public demo administrator access is disabled there; real signed-in seller access is checked separately.

## Expanded inventory

The sample source has 200 records across men’s, women’s and unisex departments. Ten contradictory/children’s listings are excluded from adult shopping, leaving 190 visible records (189 in stock). The catalogue includes tops, bottoms, jackets, dresses, shoes, bags and accessories. Department/category/search filters apply to every record; **Show more clothes** loads another 24 cards. Sample sizes span XXS–4XL and EU 35–48, with one-size accessories. Prices, size coverage and store quantities are simulated; actual seller listings retain supplied variants. Sizes, department, store, budget and the default wardrobe-pairing preference remain editable in Profile. Chat uses saved settings; checkout asks the customer to confirm the selected variants.

190 downloaded archive photographs include eight exact image references from the requested Myntra CSV and 182 full-resolution fashion dataset images. See [catalogue provenance and license notices](CATALOGUE.md) and `public/image-credits.json`.

Catalogue expansion verification (earlier release): 14 desktop/mobile Playwright journeys, four Vitest tests, TypeScript and production builds passed. All 190 added deployed image files matched their validated local copies. Live department filtering, refresh, 4XL/EU48 selection and ₹5,000 budget enforcement passed on desktop and Pixel 7 emulation. See the backend’s `docs/live-catalogue-results.json` for the collected evidence.

Stylist and saved-look cards now start with no preview garments selected. Tick owned or new pieces, then **See it on me** queues Google image generation directly. The most recently selected piece replaces conflicting clothing slots. The initial style form and Profile include **Keep my generated outfits in the same background**: unchecked requests a white background; checked keeps the reference setting. Errors link directly to photo or Profile setup. Fitting Room lists the pieces used and background requested.

### Streaming stylist and wardrobe connections

The stylist consumes authenticated SSE from `/api/chat/stream` through the Next.js proxy. Real Gemini text chunks reveal new words with a subtle fade and typing cursor, respecting reduced-motion preferences. Errors restore the message; retries use the same request ID to avoid duplicate completed replies. Outfit cards can display BigQuery Graph evidence for distinct previously checked combinations. See the backend repository's `docs/SEMANTIC_RAG.md` for retrieval, agent modules and deployment details.

Previous streaming-release verification: **17 Vitest tests and 18 Playwright journey checks** passed, along with TypeScript and the production build. A signed-in deployed browser received five real text chunks and progressively rendered 2 to 81 words; conversation restoration, reduced motion, tested desktop/mobile Axe rules and 393px mobile overflow checks passed. Anonymous demo responses remain deterministic and do not simulate model typing. See [collected live evidence](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-semantic-results.json).

### Saved preferences and occasion relevance

The chat has a **Shop new pieces / With my wardrobe** menu, initially set to new pieces, and a link to **Shopping preferences**. It no longer asks users to select department and sizes repeatedly. Core shopping settings persist even when optional style/colour memory is disabled. Photo onboarding has **Start shopping without photos**. Checkout starts with the recommended or saved available size/store and keeps explicit confirmation. Recommendations prioritize occasion relevance and different main garments; suitable owned pieces are optional, never compulsory. See the backend’s `docs/RECOMMENDATION_QUALITY.md` for collected checks and remaining limitations.

Previous conversation-release verification (13 October 2026): **21 Vitest tests, 24 desktop/mobile Playwright journeys, TypeScript and production compilation passed**. The backend’s `docs/VERIFICATION.md` records real Google model results and the distinction between local/live-service probes and deployed checks.

The earlier saved-preferences release was deployed as `flairify-web-00014-hdq` (source `7185105`). A fresh signed-in browser verified no-photo onboarding, persisted shopping settings, real Gemini/Firestore recommendations, incremental text rendering, restored wardrobe defaults, checkout confirmation, and zero tested Axe violations on desktop/mobile. The mobile document stayed within 393px. See [deployed evidence](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-occasion-deployed-results.json).

### Fitting Room shopping

Completed preview cards show only the generated image. Original photos remain manageable in the separate Reference photos tab. **Shop this look → Buy** opens checkout with all available new products from the original recommendation, including recommended products not selected for generation. Owned garments are excluded. Standalone inventory previews offer their selected products. Unavailable products are identified and omitted; prices, sizes and stock are checked again during checkout. The order is saved privately and restores in My Orders after refresh.

The local Fitting Room browser tests use explicitly labeled media fixtures, not new AI generations. They exercise real order APIs, owner isolation, full recommendation selection, desktop/mobile accessibility rules and layout. The existing Google image-generation providers were unchanged.

The previous Fitting Room update was deployed as `flairify-web-00015-q2g` (source `05aaba9`). Deployed desktop and Pixel 7 checks confirmed the preview-only card, checkout with all three recommended new products, saved orders after refresh, zero tested Axe violations and no horizontal overflow. The private verification fixture and orders were removed afterward. See [deployed checks](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-fitting-shopping-results.json).

### Conversational stylist

The Stylist restores the last open chat after refresh and exposes all chat history. Use **Refine this look**, or refer to “the second look,” then request a new colour, a variation or a specific replacement. The service preserves retained pieces and checks current size/stock/budget. Discussion questions can receive answers without another set of cards. A rounded composer includes a **Shop new pieces / With my wardrobe** menu, with a moving pink/lilac background and reduced-motion support. The logged-in welcome screen focuses on starting a conversation instead of an editorial advertisement.

### Talk with your stylist

Tap **Talk** and allow microphone access to speak naturally with Google Gemini Live. The stylist answers aloud, streams transcripts and displays real recommendation cards. It uses saved shopping preferences and recent conversation context, including follow-up changes to a selected look. Interrupt, mute or end using the voice controls. A softly animated speaking orb respects reduced-motion settings. Transcripts remain in chat history; Flairify does not store raw or generated voice audio. The microphone stops when the session ends or the page is hidden.

Voice capability checks wait for account initialization and keep guest settings separate. Talk validates availability through the authenticated server, so a slow or stale capability response cannot incorrectly disable voice. In sample demo mode, Talk opens account sign-in.

This is native Google audio, not browser text-to-speech. Signed-in accounts require the backend's configured Vertex Live integration; demo/unsupported browsers keep text chat available. The default session limit is five minutes; Talk starts another connection with saved context. Browser capture uses an AudioWorklet and Web Audio, and the backend validates a single-use ticket and exact Origin. See [setup and verification boundaries](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/VOICE_STYLIST.md).

The backend's [conversation and retrieval documentation](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/SEMANTIC_RAG.md) and [collected real-service results](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-dialogue-results.json) distinguish working Google integrations from deterministic demo behavior. No new image/video generation was part of that earlier conversation-refinement release.

The earlier conversation refinement release deployed as `flairify-web-00016-mj7` (source `308df7d`, successful Cloud Build `446fcff7-d836-414f-80fe-9e0601b37f06`). A signed-in deployed browser verified three-turn conversation continuity, exact retained garment IDs when swapping shoes, an explanation without repeated cards, visible incremental text, automatic history restoration, the wardrobe menu, reduced motion, zero tested desktop/mobile Axe violations and no overflow at 393px. The backend [verification log](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/VERIFICATION.md) documents the initial browser capture issue, resumed verification and measured limits.

Voice release verification (13 October 2026): **25 frontend logic tests and 28 desktop/mobile Playwright journeys passed**, with TypeScript and the production build. Cloud Build `1c4cd67a-4751-4d66-95e1-27cb88c5c3fd` deployed source `0af6615` as `flairify-web-00017-qgf`. A signed-in deployed browser sent three synthesized spoken utterances through the real microphone-processing path to Google, received 290 native-audio chunks, preserved the exact top/trousers when changing shoes and restored the full transcript after refresh. Mute/end, reduced motion, desktop/mobile Axe checks and 393px overflow checks passed; a separate local 320px check passed. The QA account and records were removed. Physical phone microphones and human speech quality remain unmeasured. See [collected voice evidence](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-voice-deployed-results.json).

### Account setup and fresh chats

Shopping preferences are collected immediately after registration or sign-in when the account is incomplete, before the application opens. Restored sessions and legacy profiles missing a required size follow the same flow; the chat is never briefly shown while the profile loads. Department, sizes, store, budget and optional style preferences remain editable in Profile. Returning customers with saved settings go straight into the app. Photos remain optional.

**New chat** stays visible above the conversation on desktop and mobile. It clears the draft, selected look and active reply, starts a separate conversation, and stays fresh after refresh. **Your chats** opens earlier conversations on mobile; the desktop sidebar retains them. Refresh restores only an explicitly selected chat, never an arbitrary previous conversation.

Account-entry release verification (13 October 2026): **25 frontend logic tests, 34 desktop/mobile browser journeys, TypeScript and production compilation passed**. Cloud Build `e87b627d-a659-4b53-866c-67e357071738` deployed source `c41bfa4` as `flairify-web-00018-sgf`. A temporary signed-in customer verified setup before entering the app, saved preferences, returning sign-in, two separately persisted Gemini chats, fresh-chat refresh, old-history navigation and editable Profile settings. Tested Axe rules passed on desktop/mobile; chat stayed within 393px and 320px, and the setup form within 393px. One live model request timed out and preserved the draft; retry succeeded. See [collected deployment evidence](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-entry-deployed-results.json).

Voice availability correction: the reported unavailable message was reproduced while guest capabilities were still present during sign-in restoration. **25 logic tests, 38 desktop/mobile browser journeys, TypeScript and production compilation passed**. Cloud Build `cf8c8570-9b56-4276-b8e0-9451e83c6852` deployed source `8f90a2e` as `flairify-web-00019-d4x`. The deployed retest deliberately delayed real capability responses and successfully received native Google audio and a saved transcript. No voice quota or model changes were needed. See [before/after evidence](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-voice-config-results.json).

## Voice selection and mobile space

Say “Include Vishudh Women Brown Kurta and Cobblerz Women Brown Sandals”, then “See it on me”. Retrieved pieces become selected in the cards; explicit generation opens Fitting Room and keeps the spoken reply connected. Generated images, associated buying actions and job status survive refresh. The backend validates product/wardrobe ownership, sizes, stock, photos and consent; errors remain honest. A reconnect never automatically replays a paid generation request.

Voice has a heartbeat, one bounded foreground reconnection attempt, and Google-side session resumption through ADK. End, hiding the tab, switching chats and sign-out stop microphone capture and cancel recovery. Navigating within the app keeps the current call active. A partial utterance lost with the connection may need to be repeated. Physical-device microphone quality is not established by browser emulation.

On mobile, the bottom navigation is removed. All pages remain in the hamburger menu, and chat fills the space below the header.

Voice actions release verification (13 October 2026): 25 logic tests and 42 distinct desktop/mobile journeys passed across the full run and focused reruns, plus TypeScript/production compilation. Source `fdca938` deployed as `flairify-web-00020-qhc`. A real Google voice check selected the exact named kurta/sandals, recovered after a forced disconnect, generated one Google image, reused that job on a repeated request, and restored the image/Buy action after refresh. This used synthesized speech and a licensed sample reference photo; physical microphones and quantitative likeness/fit remain unmeasured. See [collected evidence](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-voice-actions-results.json).

## Customer interface copy

The interface uses concise shopping language across onboarding, Stylist, Inventory, Saved Looks, Fitting Room, Orders, Profile and Seller Studio. Demo/sample badges, repetitive marketing footers and the Profile integration-status panel have been removed. Guest entry is **Browse as guest**; fixture wardrobe selection is **Choose starter pieces** and still requires ownership confirmation. The generic asset is named **3D studio mannequin**, never the customer.

AI-generated previews retain one short label and fit caveat. Consent controls, stock validation, sign-in requirements, order behavior and error handling are unchanged. Preview cards use current UI copy even for persisted results with old labels. No catalogue provenance flags, access controls or paid-model restrictions were removed.

## Navigate during a voice conversation

Ask **Take me back to Stylist**, **Open my wardrobe**, **Show my saved looks**, **Open the shop**, or **Go to my profile**. The call stays active while the app switches pages. **Take me back** returns to the previous screen, including after a preview opens Fitting Room; **Where we started** returns to the start of this call. Chat context and garment selections are preserved. Only known application screens are allowed. Repeated events cannot send the customer back twice, and ending voice cancels late navigation events.

Both on-screen and spoken page changes update the call’s back history. A completed explicit page request has a server fallback when Gemini acknowledges navigation without emitting a tool call. Starting a new chat still ends the previous call. Daily voice-session caps have been removed on the backend; reconnects no longer consume a daily session allowance. Individual connection timeouts and separate search/image-generation limits remain.

## Previews inside chat

Selecting garments and choosing **See it on me** in Stylist keeps the customer in chat. A compact preview card shows generation progress, the completed image, acceptance/retry/download controls and **Buy** using the same checkout dialog as Fitting Room. Text-chat jobs retain their conversation and message IDs, so previews and regenerated versions reappear with the original recommendation after refresh. The same jobs remain available in Fitting Room. Voice preview messages also render their generated image inline.
