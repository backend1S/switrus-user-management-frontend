# Switrus User Management — Frontend

React + TypeScript + Vite UI for Switrus user management: sign-in, user dashboard (counts, search, filters, table), add/edit user, disable/enable, leave, and the Loyaltri sync page. Follows the Switrus UI/UX design language.

The API is a separate project: `switrus-user-management-backend`.

```
src/
  components/ui/      design-system primitives (select, date picker, modal, tooltip, row menu, states,
                      read-only facts, breadcrumbs, brand)
  components/users/   user dialogs, status pills, avatar, account and leave cards
  pages/              Login, Users (dashboard), UserDetail (read-only record), UserForm (add/edit), Loyaltri
  layouts/            app shell, sign-in and admin-only guards
  hooks/              session (useAuth) and React Query data hooks
  services/           typed API client and endpoints
  types/  utils/  styles/  test/
nginx/                production web server config (template)
```

## How it talks to the backend

The browser calls `/api/...` on the UI's own origin. In development Vite proxies `/api` to the backend; in production nginx does. **No API key or secret is in this project or its bundle** — anything in a `VITE_*` variable is public.

Sign-in: the Login page posts the Switrus user name and password to `/auth/login`. The backend sets an HttpOnly session cookie (JavaScript cannot read it) and returns a CSRF token, which the client keeps in memory only and sends as `X-CSRF-Token` on every POST, PUT, PATCH and DELETE. After a reload, `/auth/me` restores the session (one call per page load). Any `401` returns the user to the sign-in page; `403` is shown as an access message.

Admin-only buttons and pages are hidden for read-only roles, but the backend enforces every permission itself.

Pages: `/users` (counts, filters, table), `/users/<employee id>` (read-only record for everyone who can see that employee), `/users/<employee id>?edit=1` (edit form, administrators only; others get the read-only record), `/users/new`, `/attendance` (read-only Attendance Muster; shown in the menu only when `/attendance/access` allows it, see the backend's `docs/ATTENDANCE.md`), `/integrations/loyaltri`. Employee IDs contain slashes, so links encode them (`SHPL%2FAMD%2F0426%2F2026`).

| Setting | Where | Default |
|---|---|---|
| `VITE_API_BASE_URL` | build time | `/api` (keep it; same-origin is what makes the cookie work) |
| `API_PROXY_TARGET` | `npm run dev` | `http://localhost:8001` |
| `API_UPSTREAM` | Docker / nginx at start-up | `http://host.docker.internal:8001` |
| `WEB_PORT` | docker compose | `8080` |

## Develop

Start the backend first (see its README; it can run on SQLite with sample users: `admin` / `Admin@12345`). Then:

```bash
npm install
npm run dev            # http://localhost:5173
```

## Test and build

```bash
npm test               # unit tests (vitest)
npm run build          # typecheck + production build into dist/
```

## Deploy (Docker)

```bash
API_UPSTREAM=http://<backend-host>:8001 docker compose up -d --build     # serves on :8080
```

Or build `dist/` and serve it from any web server that also proxies `/api/` to the backend with the browser's `Host` header (see `nginx/default.conf.template`). Put TLS in front.
