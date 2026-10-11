# Flairify frontend

[Open the deployed Flairify app](https://flairify-web-7kxckvikva-uc.a.run.app) · [API documentation](https://flairify-api-7kxckvikva-uc.a.run.app/docs)
A responsive Next.js web app for wardrobe-first shopping. Light pink identity, original design, accessible Radix dialogs, TanStack Query, React Hook Form/Zod, Firebase client authentication and model-viewer.

**Share your wardrobe once. Find pieces that work with your life—and see the look on you.**

## Local setup

Requires Node.js 24.12 or newer. Package versions and transitive dependencies are locked.

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Start the [FastAPI backend](https://github.com/samwin-steve/Flairify-Backend) on port 8000, then open [localhost:3000](http://localhost:3000). The backend URL is configured at runtime and stays out of the browser. Next.js proxies authenticated API and private media requests.

No credentials are needed in demo mode. Start a private demo session, enter clothing/shoe sizes, add a few photos or choose the sample wardrobe, review and confirm garments, then meet the stylist. Mumbai recommendations check the combined cost of new pieces against ₹5,000. Sample photos, prices, stock and store locations remain explicitly labeled.

## Your photo to a new look

Create an account or sign in, allow Google photo processing, and upload a clear full-body photo. Flairify automatically extracts visible garments for ownership review. Once confirmed, browse Inventory, choose a photographed clothing item, and select **Try this on**. Existing wardrobe photos also work as preview references. The Fitting Room shows your original photo and Google-generated 2D preview, with download, regenerate and delete controls.

Anonymous sample mode does not call paid models. All catalogue prices and stock remain sample facts. The active image model is Google Gemini on Vertex AI; previews are style visualizations, not exact fit predictions.

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

Downloaded clothing/editorial images are stored locally in `public/images`; source pages, authors and Unsplash/Pexels license links are recorded in [image-credits.json](public/image-credits.json). They are illustrative sample media, not merchandise offered by the depicted brands. Original fallback garment illustrations and the sample 3D mannequin are CC0. The mannequin does not represent any customer. No generative paid service outside Google Cloud is required.

[Backend documentation](https://github.com/samwin-steve/Flairify-Backend/tree/main/docs) includes architecture, integration setup, limitations, 3D research, deployment, evaluation, demo script and submission material.
