# ADR-013: Frontend patterns: one route list, small hooks, shared components

- Status: Accepted
- Date: 2026-11-01

## Context

Five interns add screens in parallel. The frontend must look and behave the same everywhere,
work at 360 px, and stay simple (no Redux).

## Decision

- `src/routes/routes.jsx` is the single list of pages: path, element, allowed roles and menu entry.
  The sidebar is built from it. `ProtectedRoute` sends users to login or a "No access" page.
- Data: `useList` (server-side paging, sort, debounced search, reload on institute switch) and
  `useRequest` (save/delete). No Redux, no React Query.
- One axios instance (`src/api/client.js`) adds the token and `X-Institute-Id`, refreshes once on
  401 and normalises errors. Pages call only files in `src/api/`.
- Shared components: PageHeader, DataTable, FormDialog (shows server field errors on the matching
  fields), ConfirmDialog, StatusChip, EmptyState, ErrorState; `Form*` wrappers for React Hook Form.
- The app-wide error screen is React Router's `errorElement`, so there is no class component.
- MUI 9: `slotProps` and `sx` only; `*Outlined` icons.

## Consequences

- Good: a new screen is mostly copying `CoursesPage.jsx`; every page handles loading, empty and error.
- Bad: interns must learn the house components instead of plain MUI.
