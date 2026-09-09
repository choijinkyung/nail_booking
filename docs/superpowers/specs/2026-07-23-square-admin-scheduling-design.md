# Square-style Admin Scheduling — Design

Date: 2026-07-23
Status: Approved (design), pending implementation plan

## Goal

Give the admin a Square-scheduler-like experience:

1. **Block off time** by range (with a reason), not just per-30-min toggles.
2. **Create bookings directly** on behalf of a customer (walk-in / phone booking),
   instantly confirmed.
3. **Manage customers by phone**: register, look up, and see new-vs-returning —
   from the admin side, not only via the public booking flow.

All three live on a **rebuilt unified calendar** as the admin's primary surface.

A follow-on feature (recurring business hours → auto-generated slots) is **out of
scope** for this spec but the data model here stays forward-compatible with it.

## Decisions (confirmed with user)

- **Block model:** range block + reason. Implemented over the existing 30-min slot
  grid via a shared `block_group` id (Approach A), not a separate `blocks` table.
- **Admin booking:** menu (service) selection + optional memo; **instantly
  `confirmed`**; **no customer email**; scheduling rules (60-min min gap, duration
  fit) **ignored** — admin may place at any 30-min start; only overlap with an
  existing `booked` slot is prevented.
- **New vs returning:** auto from completed-visit count (0 = new, 1+ = returning).
  No manual tags.
- **UI:** unified calendar, built by **evolving** existing `MiniCalendar.tsx` and
  `BookingManager.tsx` (reuse, not rewrite-from-scratch).

## Existing constraints (from codebase)

- Slots are a rigid 30-min grid; `availability_slots.starts_at` is UNIQUE.
  `status ∈ {open, booked, blocked}`.
- Booking↔slot linkage: `confirmed_slot_id` + `occupied_slot_ids[]` (the
  consecutive 30-min slots held for the duration). Partial unique index
  `bookings_one_confirmed_per_slot` prevents DB-level double-booking.
- Scheduling truth is `src/lib/scheduling.ts` (`fitFrom`, `canBook`, 30-min
  `SLOT_MIN`, 60-min `MIN_GAP_MIN`). It reads only slot *status*, so blocking a
  slot automatically removes it from customer availability — no other call sites.
- Customers are keyed on `contact` (UNIQUE) and today created **only** in
  `createBooking` (`src/app/actions.ts`). Only admin customer write is
  `saveCustomerMemo`.
- All admin writes go through `assertAdmin()`; DB reached via service_role only
  (RLS denies browser access).

## Data model changes

Migration adds one nullable column; no new tables.

```sql
alter table public.availability_slots
  add column if not exists block_group uuid;   -- groups slots blocked together
```

- A range block = the covered 30-min slots set to `status='blocked'`,
  `block_group=<uuid>`, `note_ko/en=<reason>`. Missing slots in the range are
  created; slots already `booked` cause the whole block to fail.
- Also mirror the column into `supabase/schema.sql` and `AvailabilitySlot` type.

## Server actions (new — all `assertAdmin()` first)

1. `blockRange({ dayISO, startMin, endMin, allDay?, reasonKo?, reasonEn? })`
   - Compute the 30-min starts covering `[startMin, endMin)` (or the full day when
     `allDay`). Upsert each to `blocked` with a shared `block_group`. If any covered
     slot is currently `booked`, abort and report the conflicting time(s) —
     `SLOT_TAKEN`.
2. `removeBlock({ blockGroup })`
   - Slots in the group: delete if `generated=false` and no booking references them;
     otherwise flip back to `open`. Never touch `booked` slots.
3. `createAdminBooking({ customer, serviceLines, startsAtISO, note? })`
   - `customer` is `{ id }` (existing) or `{ name, contact, email?, referral? }` (new,
     upsert by `contact`).
   - Recompute duration/price from DB services (same snapshot logic as public
     booking; never trust client prices).
   - From `startsAtISO`, take `ceil(duration/30)` consecutive 30-min slots; create
     missing ones. Atomically lock them to `booked` with rollback on partial lock /
     race (reuse `confirmBooking`'s pattern). Overlap with an existing `booked` slot
     → `SLOT_TAKEN`. **60-min gap / `canBook` rules are not applied.**
   - Insert booking `status='confirmed'`, set `confirmed_slot_id`,
     `occupied_slot_ids`, unique `code`. Customer upsert by contact.
   - **No emails.** Completion/revenue via existing `completeBooking`.
4. `createCustomer({ name, contact, email?, referral?, memo? })` — insert; on
   duplicate `contact` return existing (no dup). 
5. `updateCustomer({ customerId, ...fields })` — absorbs `saveCustomerMemo`.
6. (read) `findCustomerByContact(contact)` — for the booking form's phone match.

## UI

### Unified calendar (admin dashboard)
- **Month view** (evolve `MiniCalendar`): per-day dots for bookings/blocks; click a
  day → day panel.
- **Day timeline panel** (evolve `BookingManager`): 30-min rows for the day.
  Confirmed bookings and blocks render as spanning blocks. Empty row / buttons →
  **➕ New booking** or **⛔ Block**.
- **Pending requests** (no fixed time) stay in a separate "awaiting approval" list
  above/beside the calendar, keeping the existing confirm/decline/propose flow.

### New-booking form
- Customer selector: phone lookup (`findCustomerByContact`) or inline new-customer
  fields (shared component with the customers page). Service picker with quantities
  (reuse wizard logic) → date/time (30-min) → optional memo → `createAdminBooking`.

### Block form
- Day + start/end time or "all day" + reason → `blockRange`. Existing blocks show on
  the timeline with a remove (`removeBlock`) affordance.

### Customers page (`/admin/customers`)
- Add **➕ Register customer** and phone search. Detail keeps existing aggregation
  (visits / last visit / total spent / history). **New/Returning badge** computed
  from completed-visit count. Registration form shared with new-booking flow.

## Edge cases & error handling

- Admin booking: any target slot already `booked` → atomic failure with rollback;
  surface which time conflicts.
- Block: range containing a `booked` slot → rejected, report blocked-out times.
- Customer register: duplicate `contact` → resolve to existing customer (DB UNIQUE
  guarantees no dup); surface "already registered".
- `removeBlock` / delete never releases a slot tied to a confirmed booking.
- Admin-created bookings are normal `confirmed` bookings: they can be completed,
  cancelled, and count toward revenue/CRM like any other.

## Implementation phases

- **Phase 1 — Backend & customer CRM:** migration (`block_group`) + schema/type
  mirror; the 6 actions; `/admin/customers` register + phone search + new/returning
  badge. Independently testable.
- **Phase 2 — Unified calendar UI:** evolve MiniCalendar/BookingManager into month
  view + day timeline with ➕ New booking and ⛔ Block entry points and the shared
  customer selector.
- (Separate, later spec) Recurring business hours → auto-generated slots.

## Testing

- Action-level: admin booking slot acquisition + overlap rejection + rollback;
  block range create/remove; customer create/update + duplicate handling.
- Regression: confirm `scheduling.ts` customer-facing rules unchanged (blocked
  slots disappear from public availability; 60-min gap still enforced for the public
  wizard).
- Manual: create a walk-in booking on the calendar, block an afternoon, register a
  customer by phone and re-find them.
