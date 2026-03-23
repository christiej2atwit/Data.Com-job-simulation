
- [SPECIFICATION.md](SPECIFICATION.md)
```markdown
# Kudos System Specification

## Functional Requirements

### User Stories

1. As a user, I can select another user from a dropdown list to receive kudos.
2. As a user, I can write a message of appreciation (max 500 characters).
3. As a user, I can submit the kudos which gets stored in the database.
4. As a user, I can view a public feed of recent kudos on the dashboard.
5. As an administrator, I can hide or delete inappropriate kudos messages.
6. As an administrator, I can view moderation metadata for a kudos item (who moderated, when, and reason).

### Acceptance Criteria

- The recipient selection must list active colleagues and validate the chosen user exists.
- Messages are limited to 500 characters and sanitized before display.
- Newly submitted kudos appear in the public feed within seconds.
- Administrators can mark a kudos as hidden or permanently delete it.
- Moderation actions record `moderated_by`, `moderated_at`, and `reason_for_moderation` (optional free text).
- Hidden kudos are excluded from the public feed by default but can be retrieved by admins.
- Duplicate submissions (same sender, recipient, and message within 1 minute) are detected and rejected.
- Basic rate-limiting prevents automated spam (e.g., max 5 kudos per user per minute).

## Technical Design

### Database Schema

- `users` (reference / existing system)
  - `id` (string/UUID)
  - `name` (string)
  - `email` (string)
  - `role` (string)

- `kudos`
  - `id` (string/UUID) — primary key
  - `to_user_id` (string) — FK to `users.id`
  - `to_user_name` (string) — denormalized display name
  - `from_user_id` (string, nullable) — FK when available
  - `from_user_name` (string) — display name
  - `message` (string, max 500)
  - `timestamp` (datetime)
  - `is_visible` (boolean, default: true) — controls public visibility; when `false` the item is hidden from the public feed but retained for audit and admin review
  - `moderated_by` (string, nullable) — admin user id (or system identity) who performed moderation
  - `moderated_at` (datetime, nullable) — timestamp when moderation occurred
  - `reason_for_moderation` (string, nullable) — optional free-text reason recorded by moderator
  - `deleted` (boolean, default: false) — soft-delete flag; when `true` item is excluded from feeds and treated as removed for display purposes

Indexes:
- Index on `timestamp` for efficient recent-feed queries.
- Index on `to_user_id` for recipient lookups.

### API Endpoints

- `GET /api/users`
  - Returns: list of users (id, name, role)

- `GET /api/kudos`
  - Query params: `limit` (default 50), `offset`, `include_hidden` (admin-only)
  - Returns: paginated list of kudos ordered by `timestamp` desc

- `POST /api/kudos`
  - Body: `{ toUserId, fromUserId?, fromUserName, message }`
  - Validations: required fields, message length <= 500, recipient exists, rate-limit and duplicate detection
  - Creates new kudos with `is_visible=true`

- `PATCH /api/kudos/:id` (admin)
  - Body: `{ is_visible?, moderated_by?, moderated_at?, reason_for_moderation? }`
  - Used to hide/unhide and record moderation metadata

- `DELETE /api/kudos/:id` (admin)
  - Soft-delete: sets `deleted=true` and `is_visible=false` (optionally permanent removal in admin UI)

Authentication & Authorization:
- All endpoints require authentication. Admin endpoints require an `admin` role.
- Use existing SSO or token-based auth in production. For demo, a simple header-based username is acceptable.

### Frontend Components

- `KudosForm` — dropdown to select user, input for sender name, textarea for message, submit button
- `KudosFeed` — lists recent visible kudos with pagination; automatically refreshes every 10s
- `AdminModerationPanel` — allows admins to view hidden/deleted kudos and perform moderation actions (hide/unhide/delete)

Interactions:
- Submitting the form POSTs to `/api/kudos`; on success the feed reloads and shows the new item.
- Admin actions call PATCH/DELETE endpoints and refresh the feed.

### Security Considerations

- Validate and sanitize all inputs server-side to prevent XSS and injection.
- Authenticate requests and verify roles for moderation endpoints.
- Implement rate limiting and duplicate detection to mitigate spam.
- Log moderation actions for audit.

### Performance Considerations

- Use pagination for the feed and limit results (default 50).
- Cache recent feed results in-memory (short TTL) if load increases.

### Error Handling & Logging

- Return clear HTTP status codes and JSON error bodies.
- Log server errors with context (request id, user id).

## Implementation Plan

1. Finalize SPECIFICATION.md and approve.
2. Scaffold project (Express backend + static frontend).
3. Implement database model and JSON-backed persistence for demo.
4. Implement API endpoints with validation and basic rate-limiting/duplicate checks.
5. Implement frontend `KudosForm` and `KudosFeed`.
6. Add admin moderation endpoints and minimal admin UI.
7. Write tests for API validation and moderation flows.
8. Prepare deployment instructions and harden security for production.

## Testing Strategy

- Unit test API validation logic (message length, recipient existence).
- Integration test for POST/GET kudos round-trip.
- Admin moderation tests for PATCH/DELETE behavior.

## Deployment Considerations

- For demo: run on Node 16+ with local JSON persistence.
- For production: use persistent DB (Postgres), integrate with SSO, enable HTTPS, and configure logging/monitoring.

---

Approved by the architect: [Pending approval]