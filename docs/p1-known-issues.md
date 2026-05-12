# P1 Known Issues (Non-blocking)

These were surfaced during P1 build / acceptance. None block the core LINE-webhook-to-bank-reconciliation flow; each has a workaround and a P2 fix path.

---

## KI-1: `/api/cron/flush-pending-image-groups` runs on-demand, not on a schedule

**Scope:** Pending image groups whose 30s `setTimeout` flush never fired (function instance recycled before the timer fired).
**Why:** Vercel Hobby plan caps cron schedules at once-per-day. Our needed cadence is per-minute, which only Pro+ allows. The cron route still exists and works — there's just no scheduler attached.
**Behaviour:** In rare cases (instance churn + no follow-up LINE traffic from the same user), a `pending_image_groups` row stays in `status='pending'` until either the next image from that user arrives (triggers append + a fresh timer) or an operator manually sweeps:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<domain>/api/cron/flush-pending-image-groups
```
**Workaround:** Manual curl when `/admin/health` (or a Supabase query) shows stale pending groups.
**Fix path:** Upgrade to Vercel Pro and re-add `crons` block to `vercel.json`, or wire Supabase `pg_cron + pg_net` to hit the endpoint every minute.

## KI-2: `setTimeout`-based flush is best-effort

**Scope:** All image-message flows.
**Why:** Vercel Functions (even Fluid Compute) don't guarantee `setTimeout` fires after the HTTP response goes out. Most of the time the instance lives long enough; occasionally it doesn't.
**Behaviour:** Same observable outcome as KI-1 — a group sits as `pending` longer than 30s. Atomic claim inside `processGroupIfReady` ensures we never double-process when both a timer **and** a manual sweep fire on the same row.
**Workaround:** Same as KI-1.
**Fix path:** Move to a true durable queue (Vercel Queues / Supabase pg_cron / external scheduler).

## KI-3: LLM occasionally returns `""` instead of `null` for missing fields

**Scope:** `parseOrderText` and `parseOrderFromImages`.
**Behaviour:** Claude Haiku sometimes emits an empty string for nullable fields the prompt asked to leave `null`. Before this was caught by `nullableTrimmedString`, the empty string would propagate to a Postgres `date` column and the whole order insert would fail with `22007 invalid input syntax for type date`.
**Mitigation already in place:** `nullableTrimmedString` Zod helper coerces `""`/whitespace to `null` before the draft is built. `image_quality` enum guards via `z.preprocess` so unknown/missing values fall back to `"unreadable"`.
**Fix path:** Eventually consider Anthropic's structured output mode or tool-calling to remove ambiguity entirely.

## KI-4: Customer aggregates only increment, never decrement

**Scope:** `customers.total_orders` / `total_amount` / `last_ordered_at`.
**Behaviour:** Both paste-mode and webhook-mode add `+1 / + amount` when an order is created, mirroring each other. Deleting or cancelling an order does **not** subtract from these denormalised totals. Merging customers does recompute correctly because `mergeCustomers` runs a full re-aggregation.
**Workaround:** For now, totals drift slowly. Run an admin re-aggregation by performing a no-op merge (or via SQL `UPDATE customers SET total_orders=..., total_amount=..., last_ordered_at=...` based on a `SELECT` from orders).
**Fix path:** P2 — add a periodic `recompute_customer_aggregates(farmer_id)` cron, or hook order deletion/cancellation events to decrement.

## KI-5: Webhook flow does not overwrite customer `default_name` / `default_address` / `notes`

**Scope:** Customers auto-created or fuzzy-matched via `ensureLineUserLinked`.
**Why this is intentional:** LLM-parsed recipient info is less trusted than the farmer's own confirmed paste-mode entry. We don't want LINE noise (e.g. customer typing "送這次老地方") clobbering farmer-curated defaults.
**Behaviour:** Order rows still carry the per-order `recipient_name` / `recipient_address` snapshots (so the actual delivery happens correctly); customer table defaults remain whatever the farmer set last. Inconsistent with paste-mode which does overwrite `default_name` / `default_address` if the form provides them.
**Fix path:** Make this configurable per-farmer (e.g. `farmers.auto_overwrite_customer_defaults boolean`) when more than one farmer is on the system.

## KI-6: Image group requires a known `source.userId`

**Scope:** Webhook image messages.
**Behaviour:** If LINE delivers an image event without `source.userId` (extremely rare — would mainly happen in non-1:1 chats), `processLineEvent` throws and the event is marked `error`. We don't fall back to a single-image draft path.
**Workaround:** Re-send the image as a 1:1 message. If you hit this in real customer traffic, file an issue with the offending `line_webhook_events.raw_payload`.
**Fix path:** Synthesise a sentinel source_user_id when truly absent, or accept ungrouped per-image processing.

## KI-7: Reconciliation parsers only support 郵局 and 國泰 CSV formats

**Scope:** `/api/reconciliation/upload`.
**Behaviour:** Unknown column layouts return a parser error. P1 explicitly targeted these two formats because the seed farmers use them.
**Fix path:** Add new parser modules under `src/lib/reconciliation/parsers/` as new banks come up.

---

**Total: 7 known issues, all with workarounds, none blocking the happy path.**
