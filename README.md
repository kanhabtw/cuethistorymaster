# CUET History Master

An NCERT-based study and practice app for CUET History.

## Run locally

1. Install Node.js and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` for AI-generated content. `PORT` defaults to `3000`.
4. Start the Express server with `npm start` and open `http://localhost:3000`.

## Project layout

- `server.js` contains the Express server and API routes.
- `public/` contains `index.html`, `site-styles.css`, `chapter-interface.js`, `chapter-search.js`, `seo-metadata.js`, and crawler files served to visitors.
- `database/` stores cached chapter content.
- `ncert_pdfs/` contains source PDFs used to generate chapter content.
- `generate-single-chapter-assertions.js`, `generate-all-chapter-assertions.js`, and `regenerate-all-chapter-assertions.js` are maintenance scripts.

AI generation and refresh operations require a valid OpenRouter API key. Cached chapter content can be served without one.

AI endpoints are limited to 20 requests per IP per hour and 50 requests per server process per hour. These limits are in-memory and reset on restart; multi-instance deployments need a shared rate-limit store.
