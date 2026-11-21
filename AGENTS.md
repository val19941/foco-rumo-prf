<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (FocusStudy)

- All user data lives on the device in one persisted zustand store (`src/lib/store.ts`, localStorage key `focusstudy-v1`); no Lovable Cloud. Why: the brief requires local-first, private storage with JSON backup.
- Pages render client-only via `<ClientOnly>` in `__root.tsx`. Why: state comes from localStorage, so SSR would hydrate-mismatch.
- Business rules (spaced review, priority, weekly plan, analytics, advisor) are pure functions in `src/lib/*` covered by `src/test/rules.test.ts`; UI only calls them. Why: keeps rules testable and consistent across pages.
- Seed data uses deterministic IDs; generate random IDs only inside handlers. Why: Workers forbid randomness at module scope.
- The AI advisor (`src/lib/advisor.functions.ts`) receives only an aggregated study summary — never medication/dose data or notes — and its output is filtered for medication terms. Why: health data must stay private and the AI must not give medication advice.
- `public/notifications-sw.js` is a notification-only worker (no fetch handler, no caching, scope `/notify/`). Why: Android Chrome shows local notifications only via a service worker; there is no offline/app-shell caching.
- Insights are phrased as correlations from the user's own records and never attribute differences to the medication.
