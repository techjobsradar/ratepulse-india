# RatePulse India — starter website

A responsive React + Vite frontend for an India-focused information portal covering fuel prices, gold/silver/diamond guidance, financial explainers and news.

## Run locally on macOS

1. Install Node.js LTS from https://nodejs.org/ if it is not already installed.
2. Extract this ZIP and open Terminal in the `ratepulse-india` folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the local URL Vite prints (usually `http://localhost:5173`).

## Important before publishing

- **Fuel prices shown are demo placeholders**, not live or verified prices. Remove or replace them with a properly licensed/authoritative data source and show the source and last-updated time.
- Gold and silver prices are intentionally not fabricated; connect a reliable provider before publishing rates.
- Diamond prices depend on cut, colour, clarity, carat weight, certification and seller; avoid presenting one universal rate.
- News cards are starter examples, not current news. Publish original, fact-checked articles or use permitted news feeds with attribution.
- Newsletter form is a UI demonstration only. It does not store or send email addresses.
- Footer policy links are placeholders. Add real About, Contact, Privacy, Terms, Editorial and Affiliate Disclosure pages.
- Advertising and affiliate earnings are not guaranteed. Apply to services only after the site has sufficient original content and meets their policies.
- This frontend does not sell or arrange delivery of petrol, diesel or kerosene. Such activity may require licences and regulatory compliance.

## Build for deployment

```bash
npm run build
npm run preview
```

The production files are created in `dist/`. You can deploy the frontend to Vercel, Netlify or another static hosting service.

## Suggested next milestones

1. Add a backend API and database.
2. Integrate licensed/official rate sources and scheduled refreshes.
3. Add article management and source citations.
4. Add sitemap, robots.txt, structured metadata, accessibility checks and real policy pages.
5. Configure analytics, consent/privacy requirements and ad placement only after review.
