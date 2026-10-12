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

Start the [FastAPI backend](https://github.com/samwin-steve/Flairify-Backend) on port 8000, then open [localhost:3000](http://localhost:3000). The backend URL is configured at runtime and stays out of the browser. Next.js proxies authenticated API and private media requests.

No credentials are needed in demo mode. Start a private demo session, save department, clothing/shoe sizes, store and budget, then start shopping without photos. Optionally add photos or the sample wardrobe, review and confirm garments, and enable “Pair with my wardrobe” in chat. Mumbai recommendations check the combined cost of new pieces against ₹5,000. Sample photos, prices, stock and store locations remain explicitly labeled.

## Your photo to a new look

Create an account or sign in, allow Google photo processing, and upload a clear full-body photo. Flairify automatically extracts visible garments for ownership review. Once confirmed, browse Inventory, choose a photographed clothing item, and select **Try this on**. Existing wardrobe photos also work as preview references. The Fitting Room shows your original photo and Google-generated 2D preview, with download, regenerate and delete controls.

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

## Seller Studio and mock shopping

- **Seller Studio** is available in the desktop navigation and mobile navigation drawer. Approved sellers add a photo, price, sizes, and stock through **Add clothes**. Owners can approve access requests. Shared inventory edits require a verified owner or seller role; the deployed anonymous demo cannot unlock them.
- **Inventory → Mock buy** works without wardrobe onboarding or chat. New users can choose **Browse clothes first** during onboarding. Personal stylist conversations require saved shopping sizes; wardrobe pairing is optional.
- **Mock buy new pieces** on a stylist look uses the same reviewed checkout. Only new products are charged in the displayed mock total; owned pieces are excluded.
- **My Orders** shows persisted order snapshots after refresh. Checkout explicitly acknowledges no payment or delivery. Sellers see their listed items in **Mock orders received**. Stock is checked but never reserved or decremented for a mock purchase.
- Sample listings remain labeled. New seller listings are shown once their backend indexing job succeeds. Adding a listing makes it eligible for matching recommendations; it does not guarantee inclusion in every look.

Local browser verification covers direct checkout before onboarding, a stylist checkout, order persistence, photographed seller listings, stock updates, desktop/mobile overflow, and accessibility scans of the new dialogs. Run the backend with `ENABLE_DEMO_ADMIN=true` and `DEMO_ADMIN_KEY=test-admin-key` for the local seller test. The seller test is skipped when `PLAYWRIGHT_BASE_URL` points at a deployment because public demo administrator access is disabled there; real signed-in seller access is checked separately.

## Expanded inventory

The sample source has 200 records across men’s, women’s and unisex departments. Ten contradictory/children’s listings are excluded from adult shopping, leaving 190 visible records (189 in stock). The catalogue includes tops, bottoms, jackets, dresses, shoes, bags and accessories. Department/category/search filters apply to every record; **Show more clothes** loads another 24 cards. Sample sizes span XXS–4XL and EU 35–48, with one-size accessories. Prices, size coverage and store quantities are simulated; actual seller listings retain supplied variants. Sizes, department, store, budget and the default wardrobe-pairing preference remain editable in Profile. Chat uses saved settings; checkout asks the customer to confirm the selected variants.

190 downloaded archive photographs include eight exact image references from the requested Myntra CSV and 182 full-resolution fashion dataset images. See [catalogue provenance and license notices](CATALOGUE.md) and `public/image-credits.json`.

Catalogue expansion verification (earlier release): 14 desktop/mobile Playwright journeys, four Vitest tests, TypeScript and production builds passed. All 190 added deployed image files matched their validated local copies. Live department filtering, refresh, 4XL/EU48 selection and ₹5,000 budget enforcement passed on desktop and Pixel 7 emulation. See the backend’s `docs/live-catalogue-results.json` for the collected evidence.

Stylist and saved-look cards now start with no preview garments selected. Tick owned or new pieces, then **See it on me** queues Google image generation directly. The most recently selected piece replaces conflicting clothing slots. The initial style form and Profile include **Keep my generated outfits in the same background**: unchecked requests a white background; checked keeps the reference setting. Errors link directly to photo or Profile setup. Fitting Room lists the pieces used and background requested.

### Streaming stylist and wardrobe connections

The stylist consumes authenticated SSE from `/api/chat/stream` through the Next.js proxy. Real Gemini text chunks reveal new words with a subtle fade and typing cursor, respecting reduced-motion preferences. Errors restore the message; retries use the same request ID to avoid duplicate completed replies. Outfit cards can display BigQuery Graph evidence for distinct previously checked combinations. See the backend repository's `docs/SEMANTIC_RAG.md` for retrieval, agent modules and deployment details.

Previous streaming-release verification: **17 Vitest tests and 18 Playwright journey checks** passed, along with TypeScript and the production build. A signed-in deployed browser received five real text chunks and progressively rendered 2 to 81 words; conversation restoration, reduced motion, tested desktop/mobile Axe rules and 393px mobile overflow checks passed. Anonymous demo responses remain deterministic and do not simulate model typing. See [collected live evidence](https://github.com/samwin-steve/Flairify-Backend/blob/main/docs/live-semantic-results.json).

### Saved preferences and occasion relevance

The chat has a **Pair with my wardrobe** switch, initially off, and a link to **Shopping preferences**. It no longer asks users to select department and sizes repeatedly. Core shopping settings persist even when optional style/colour memory is disabled. Photo onboarding has **Start shopping without photos**. Checkout starts with the recommended or saved available size/store and keeps explicit confirmation. Recommendations prioritize occasion relevance and different main garments; suitable owned pieces are optional, never compulsory. See the backend’s `docs/RECOMMENDATION_QUALITY.md` for collected checks and remaining limitations.

Latest local verification (12 October 2026): **21 Vitest tests, 20 desktop/mobile Playwright journeys, TypeScript and production compilation passed**. The backend’s `docs/VERIFICATION.md` records real Google model results and the distinction between local/live-service probes and deployed checks.
