# Square-style Admin Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a Square-scheduler experience — block time by range, create bookings directly (instantly confirmed), and manage customers by phone — all on the existing admin calendar.

**Architecture:** Server actions in `src/app/admin/actions.ts` (all gated by `assertAdmin()`, DB via service_role) do the writes; the existing 30-min slot grid absorbs range-blocks via a new `block_group` column. The `/admin/calendar` `BookingCalendar` component gains block rendering + a new-booking form + a block form; `/admin/customers` gains registration + phone search. Pure scheduling/mapping logic is extracted into `src/lib/` and unit-tested with Vitest; server actions and UI are verified with `tsc`, `lint`, and manual dev-server checks.

**Tech Stack:** Next.js 16 (server actions, `"use server"`), React 19, Supabase (`@supabase/supabase-js`, service_role), TypeScript strict, Tailwind v4, Vitest (new, for pure helpers only).

## Global Constraints

- Next.js 16 in this repo may differ from training data — before writing Next-specific code, check `node_modules/next/dist/docs/`. (from AGENTS.md)
- Every admin server action MUST call `await assertAdmin()` first (`@/lib/auth`). It throws `"UNAUTHORIZED"`.
- DB is reached ONLY server-side via `createSupabaseAdminClient()` (`@/lib/supabase/admin`); RLS denies browser access.
- Slots are a rigid 30-min grid. `availability_slots.starts_at` is UNIQUE. `status ∈ {"open","booked","blocked"}`.
- Timezone display is `America/Vancouver`; slot instants are stored as UTC ISO. Client builds ISO lists from the admin's local time (same pattern as the existing `AvailabilityManager` / `addSlots`) — do NOT do server-side Vancouver↔UTC math.
- Admin-created bookings: status `confirmed` immediately, **NO customer email**, scheduling rules (`canBook` 60-min gap) NOT applied; only overlap with an existing `booked` slot is rejected.
- New-vs-returning is computed from completed-visit count (0 = new, 1+ = returning). No manual tags.
- `bookings.code` is NOT NULL UNIQUE; `customer_name`/`customer_contact` NOT NULL; `lookup_password_hash/salt` default `''` (leave empty for admin bookings); `preferred_slot_id`/`confirmed_slot_id` nullable.
- `customers.contact` is NOT NULL UNIQUE — the dedup key.
- Verification per task: `npx tsc --noEmit` (0 errors) and `npm run lint` (0 errors) always; `npx vitest run` for tasks that add pure helpers; manual dev-server (`npm run dev`) checks for UI/action tasks.
- Commit after every task. Do not push unless asked.

## File Structure

**New files**
- `vitest.config.ts` — Vitest config (Node env, no alias needed; tests use relative imports).
- `src/lib/code.ts` — `generateCode()` (moved out of `src/app/actions.ts`, shared by public + admin booking).
- `src/lib/code.test.ts` — unit test for `generateCode`.
- `src/lib/bookingLines.ts` — pure `buildServiceLines(services, selections)` mapper.
- `src/lib/bookingLines.test.ts` — unit test.
- `src/lib/scheduling.test.ts` — unit tests for `slotStartsForDuration` (+ existing helpers regression).
- `src/components/admin/CustomerPicker.tsx` — shared customer select/register control (phone lookup + inline new).
- `src/components/admin/NewBookingForm.tsx` — admin booking creation form (used from the calendar day panel).
- `src/components/admin/BlockForm.tsx` — range/all-day block form (used from the calendar day panel).
- `supabase/migrations/20260703020000_block_group.sql` — adds `availability_slots.block_group`.

**Modified files**
- `supabase/schema.sql` — mirror the `block_group` column.
- `src/lib/types.ts` — add `block_group` to `AvailabilitySlot`; add admin action input types if helpful.
- `src/lib/scheduling.ts` — add `slotStartsForDuration`.
- `src/app/actions.ts` — import `generateCode` from `@/lib/code` (remove local copy).
- `src/app/admin/actions.ts` — new actions: `blockRange`, `removeBlock`, `createAdminBooking`, `createCustomer`, `updateCustomer`, `findCustomerByContact`; keep `saveCustomerMemo` as a thin wrapper over `updateCustomer` (or leave; see Task 6).
- `src/lib/data.ts` — `getBlocks()` (grouped blocked slots) for the calendar; ensure `getAllServices`/`getCustomers` available to calendar page.
- `src/app/admin/calendar/page.tsx` — fetch blocks + active services + customers, pass to `BookingCalendar`.
- `src/components/admin/BookingCalendar.tsx` — render blocks; add ➕ New booking / ⛔ Block entry points on the day panel.
- `src/app/admin/customers/page.tsx` — pass `isReturning` and keep aggregation.
- `src/components/admin/CustomersManager.tsx` — register button + phone search + new/returning badge; use `updateCustomer`.
- `src/lib/i18n.ts` — new admin dict keys (ko + en).

---

## Phase 1 — Backend & Customer CRM

### Task 1: Vitest setup + `slotStartsForDuration` pure helper

**Files:**
- Create: `vitest.config.ts`, `src/lib/scheduling.test.ts`
- Modify: `src/lib/scheduling.ts`, `package.json`

**Interfaces:**
- Produces: `slotStartsForDuration(startISO: string, durationMin: number): string[]` — the 30-min slot-start ISO strings (UTC) covering the duration, count = `neededSlots(durationMin)`.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add config and test script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 3: Write the failing test**

Create `src/lib/scheduling.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slotStartsForDuration, neededSlots } from "./scheduling";

describe("slotStartsForDuration", () => {
  it("returns one slot for a 30-min service", () => {
    expect(slotStartsForDuration("2026-07-24T18:00:00.000Z", 30)).toEqual([
      "2026-07-24T18:00:00.000Z",
    ]);
  });

  it("returns consecutive 30-min starts covering a 90-min service", () => {
    expect(slotStartsForDuration("2026-07-24T18:00:00.000Z", 90)).toEqual([
      "2026-07-24T18:00:00.000Z",
      "2026-07-24T18:30:00.000Z",
      "2026-07-24T19:00:00.000Z",
    ]);
  });

  it("rounds a non-multiple duration up to whole slots", () => {
    expect(slotStartsForDuration("2026-07-24T18:00:00.000Z", 45)).toHaveLength(
      neededSlots(45),
    );
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/scheduling.test.ts`
Expected: FAIL — `slotStartsForDuration is not a function`.

- [ ] **Step 5: Implement the helper**

Append to `src/lib/scheduling.ts`:

```ts
/** startISO(UTC)부터 durationMin 을 채우는 연속 30분 슬롯 시작 ISO 목록 */
export function slotStartsForDuration(
  startISO: string,
  durationMin: number,
): string[] {
  const need = neededSlots(durationMin);
  const t0 = new Date(startISO).getTime();
  const step = SLOT_MIN * 60000;
  const out: string[] = [];
  for (let k = 0; k < need; k++) {
    out.push(new Date(t0 + k * step).toISOString());
  }
  return out;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/scheduling.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add vitest.config.ts package.json package-lock.json src/lib/scheduling.ts src/lib/scheduling.test.ts
git commit -m "test: add Vitest + slotStartsForDuration scheduling helper"
```

---

### Task 2: `block_group` column (migration + schema + type)

**Files:**
- Create: `supabase/migrations/20260703020000_block_group.sql`
- Modify: `supabase/schema.sql`, `src/lib/types.ts`

**Interfaces:**
- Produces: `availability_slots.block_group uuid null`; `AvailabilitySlot.block_group: string | null`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260703020000_block_group.sql`:

```sql
-- 범위 블록(Square식 'block off time') 그룹 식별자.
-- 같은 block_group 을 가진 blocked 슬롯들은 하나의 블록으로 함께 생성/해제된다.
alter table public.availability_slots
  add column if not exists block_group uuid;

create index if not exists availability_slots_block_group_idx
  on public.availability_slots (block_group);
```

- [ ] **Step 2: Mirror into schema.sql**

In `supabase/schema.sql`, in the `availability_slots` section (near the `generated` column added by the earlier migration), add the same `add column if not exists ... block_group uuid;` and the index, so a fresh `schema.sql` apply matches migrations.

- [ ] **Step 3: Add to the type**

In `src/lib/types.ts`, in `interface AvailabilitySlot`, add after `generated: boolean;`:

```ts
  block_group: string | null;
```

- [ ] **Step 4: Fix the DEFAULT fallback if needed**

`src/lib/data.ts` has no default `AvailabilitySlot`, so nothing else to change. Run `npx tsc --noEmit` and fix any object literal that constructs an `AvailabilitySlot` without `block_group` (add `block_group: null`).

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors. `npm run lint` → 0 errors.

```bash
git add supabase/migrations/20260703020000_block_group.sql supabase/schema.sql src/lib/types.ts src/lib/data.ts
git commit -m "feat: add availability_slots.block_group for range blocks"
```

---

### Task 3: Extract `generateCode` + pure `buildServiceLines`

**Files:**
- Create: `src/lib/code.ts`, `src/lib/code.test.ts`, `src/lib/bookingLines.ts`, `src/lib/bookingLines.test.ts`
- Modify: `src/app/actions.ts`

**Interfaces:**
- Produces:
  - `generateCode(len?: number): string` — human-unambiguous code (alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
  - `buildServiceLines(services: Service[], selections: { service_id: string; quantity: number }[]): BookingServiceLine[]` — DB-price snapshot, qty clamped 1–20, unknown ids dropped.
- Consumes: `Service`, `BookingServiceLine` from `@/lib/types`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/code.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateCode } from "./code";

describe("generateCode", () => {
  it("has the requested length and only safe chars", () => {
    const c = generateCode(6);
    expect(c).toHaveLength(6);
    expect(c).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
  });
});
```

Create `src/lib/bookingLines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildServiceLines } from "./bookingLines";
import type { Service } from "./types";

const svc = (over: Partial<Service>): Service => ({
  id: "s1", name_ko: "원컬러", name_en: "One color", price: 30, price_from: false,
  unit: "flat", duration_min: 90, description_ko: "", description_en: "",
  sort_order: 0, active: true, created_at: "",
  ...over,
});

describe("buildServiceLines", () => {
  it("snapshots price and clamps quantity", () => {
    const lines = buildServiceLines([svc({ id: "s1", price: 30 })], [
      { service_id: "s1", quantity: 99 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(20);
    expect(lines[0].subtotal).toBe(600);
    expect(lines[0].unit_price).toBe(30);
  });

  it("drops unknown service ids", () => {
    expect(buildServiceLines([], [{ service_id: "x", quantity: 1 }])).toEqual([]);
  });
});
```

(If the `Service` interface fields differ, match them exactly — read `src/lib/types.ts` first.)

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/code.test.ts src/lib/bookingLines.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `code.ts`**

Create `src/lib/code.ts` (moved verbatim from `src/app/actions.ts`):

```ts
// 사람이 헷갈리지 않는 문자만 사용 (0/O, 1/I 제외)
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateCode(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}
```

- [ ] **Step 4: Implement `bookingLines.ts`**

Create `src/lib/bookingLines.ts`:

```ts
import type { BookingServiceLine, Service } from "./types";

/** DB 가격 기준 시술 스냅샷 생성. 수량 1–20 클램프, 없는 id 는 제외. */
export function buildServiceLines(
  services: Service[],
  selections: { service_id: string; quantity: number }[],
): BookingServiceLine[] {
  const map = new Map(services.map((s) => [s.id, s]));
  const lines: BookingServiceLine[] = [];
  for (const sel of selections) {
    const svc = map.get(sel.service_id);
    if (!svc) continue;
    const qty = Math.max(1, Math.min(20, Math.floor(sel.quantity || 1)));
    lines.push({
      service_id: svc.id,
      name_ko: svc.name_ko,
      name_en: svc.name_en,
      unit: svc.unit,
      unit_price: Number(svc.price),
      duration_min: Number(svc.duration_min) || 0,
      quantity: qty,
      subtotal: Number(svc.price) * qty,
    });
  }
  return lines;
}
```

- [ ] **Step 5: Rewire `src/app/actions.ts`**

Remove the local `CODE_ALPHABET` + `generateCode` (lines ~70–78) and add `import { generateCode } from "@/lib/code";`. Optionally replace the inline snapshot loop in `createBooking` with `buildServiceLines(svcRows ?? [], input.services)` — only if it keeps behavior identical (active-only filter stays in the query). Keep this change minimal to avoid regressions; if unsure, leave `createBooking`'s loop and just share `generateCode`.

- [ ] **Step 6: Verify**

Run: `npx vitest run src/lib/code.test.ts src/lib/bookingLines.test.ts` → PASS.
Run: `npx tsc --noEmit` → 0 errors. `npm run lint` → 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/code.ts src/lib/code.test.ts src/lib/bookingLines.ts src/lib/bookingLines.test.ts src/app/actions.ts
git commit -m "refactor: extract generateCode + buildServiceLines to shared libs"
```

---

### Task 4: `blockRange` + `removeBlock` actions

**Files:**
- Modify: `src/app/admin/actions.ts`

**Interfaces:**
- Consumes: `assertAdmin`, `createSupabaseAdminClient`, `revalidatePath`.
- Produces:
  - `blockRange(input: { startsAtISOs: string[]; reasonKo?: string; reasonEn?: string }): Promise<ActionResult>` — the client generates the 30-min ISO list (a contiguous range, or a full business day for "all day"). Creates/updates each to `status:'blocked'` sharing one `block_group`. If any target time is already `booked`, aborts with `SLOT_TAKEN` and touches nothing.
  - `removeBlock(input: { blockGroup: string }): Promise<ActionResult>` — for slots in the group: delete when `generated=false` and not referenced by a booking; else flip to `open`. Never touches `booked`.

- [ ] **Step 1: Implement `blockRange`**

Add to `src/app/admin/actions.ts`:

```ts
export async function blockRange(input: {
  startsAtISOs: string[];
  reasonKo?: string;
  reasonEn?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const isos = [...new Set((input.startsAtISOs ?? []).filter(Boolean))];
  if (isos.length === 0) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();

  // 1) 대상 시간대에 이미 booked 슬롯이 있으면 전체 거부
  const { data: existing } = await sb
    .from("availability_slots")
    .select("starts_at, status")
    .in("starts_at", isos);
  const booked = (existing as { starts_at: string; status: string }[] | null)
    ?.filter((s) => s.status === "booked");
  if (booked && booked.length > 0) {
    return { ok: false, error: "SLOT_TAKEN" };
  }

  // 2) 블록 그룹으로 upsert (open/신규 → blocked). booked 는 위에서 걸러짐.
  const group = crypto.randomUUID();
  const note_ko = (input.reasonKo ?? "").trim();
  const note_en = (input.reasonEn ?? "").trim();
  const { error } = await sb.from("availability_slots").upsert(
    isos.map((iso) => ({
      starts_at: iso,
      status: "blocked",
      block_group: group,
      note_ko,
      note_en,
    })),
    { onConflict: "starts_at" },
  );
  if (error) return { ok: false, error: "DB" };

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/availability");
  return { ok: true };
}
```

Note: `upsert` with `onConflict:"starts_at"` overwrites an existing `open` slot's status to `blocked` and stamps `block_group`. Because booked rows were rejected in step 1, no booked slot is overwritten. (If a race turns a slot booked between the check and the upsert, the confirmed-booking flow's own locking still protects the booking; the block simply shouldn't be created over it — acceptable for admin single-user use.)

- [ ] **Step 2: Implement `removeBlock`**

```ts
export async function removeBlock(input: {
  blockGroup: string;
}): Promise<ActionResult> {
  await assertAdmin();
  if (!input.blockGroup) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();
  // 그룹의 blocked 슬롯만 삭제 (generated 여부와 무관하게, 블록은 관리자가 만든 것).
  // booked 는 애초에 이 그룹에 속하지 않음.
  const { error } = await sb
    .from("availability_slots")
    .delete()
    .eq("block_group", input.blockGroup)
    .eq("status", "blocked");
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/availability");
  return { ok: true };
}
```

(Deleting blocked slots is safe: blocked slots hold no booking. This keeps the grid clean; if recurring-hours auto-generation later wants them back it will regenerate.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → 0. `npm run lint` → 0.
Manual (dev server, after applying the migration to your Supabase): none yet — no UI. Defer manual to Task 9.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/actions.ts
git commit -m "feat: blockRange + removeBlock admin actions"
```

---

### Task 5: `createAdminBooking` action

**Files:**
- Modify: `src/app/admin/actions.ts`

**Interfaces:**
- Consumes: `generateCode` (`@/lib/code`), `buildServiceLines` (`@/lib/bookingLines`), `slotStartsForDuration` + `bookingDurationMin` (`@/lib/scheduling`).
- Produces: `createAdminBooking(input: { customer: { id: string } | { name: string; contact: string; email?: string; referral?: string }; services: { service_id: string; quantity: number }[]; startsAtISO: string; note?: string }): Promise<{ ok: true; code: string } | { ok: false; error: string }>` — creates an instantly-`confirmed` booking, no email.

- [ ] **Step 1: Add imports**

At the top of `src/app/admin/actions.ts` add:

```ts
import { generateCode } from "@/lib/code";
import { buildServiceLines } from "@/lib/bookingLines";
import { slotStartsForDuration } from "@/lib/scheduling"; // add to the existing scheduling import
import type { Service } from "@/lib/types"; // add to existing type import
```

- [ ] **Step 2: Implement the action**

```ts
export async function createAdminBooking(input: {
  customer:
    | { id: string }
    | { name: string; contact: string; email?: string; referral?: string };
  services: { service_id: string; quantity: number }[];
  startsAtISO: string;
  note?: string;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  await assertAdmin();
  if (!input.startsAtISO) return { ok: false, error: "INVALID" };
  if (!input.services || input.services.length === 0)
    return { ok: false, error: "NO_SERVICE" };
  const sb = createSupabaseAdminClient();

  // 1) 시술 스냅샷 (DB 가격 기준)
  const serviceIds = [...new Set(input.services.map((s) => s.service_id))];
  const { data: svcRows } = await sb
    .from("services")
    .select("*")
    .in("id", serviceIds)
    .eq("active", true);
  const lines = buildServiceLines((svcRows as Service[]) ?? [], input.services);
  if (lines.length === 0) return { ok: false, error: "NO_SERVICE" };
  const estimatedTotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const duration = bookingDurationMin(lines);

  // 2) 고객 확정 (기존 id 또는 연락처 upsert)
  let customerId: string | null = null;
  let name = "";
  let contact = "";
  let email = "";
  let referral = "";
  if ("id" in input.customer) {
    const { data: c } = await sb
      .from("customers")
      .select("id, name, contact, email, referral_source")
      .eq("id", input.customer.id)
      .maybeSingle();
    if (!c) return { ok: false, error: "NO_CUSTOMER" };
    const cc = c as { id: string; name: string; contact: string; email: string; referral_source: string };
    customerId = cc.id; name = cc.name; contact = cc.contact; email = cc.email; referral = cc.referral_source;
  } else {
    name = (input.customer.name ?? "").trim();
    contact = (input.customer.contact ?? "").trim();
    email = (input.customer.email ?? "").trim();
    referral = (input.customer.referral ?? "").trim();
    if (!name || !contact) return { ok: false, error: "INVALID" };
    const { data: existing } = await sb
      .from("customers").select("id").eq("contact", contact).maybeSingle();
    if (existing) {
      customerId = (existing as { id: string }).id;
      await sb.from("customers").update({ name, email }).eq("id", customerId);
    } else {
      const { data: created } = await sb
        .from("customers")
        .insert({ contact, name, email, referral_source: referral })
        .select("id").single();
      customerId = (created as { id: string } | null)?.id ?? null;
    }
  }

  // 3) 소요시간만큼 연속 30분 슬롯 확보 (없으면 생성). 규칙 무시, booked 와만 충돌 금지.
  const occIsos = slotStartsForDuration(input.startsAtISO, duration);
  // 없는 슬롯은 open 으로 생성 (이미 있으면 무시)
  const { error: seedErr } = await sb.from("availability_slots").upsert(
    occIsos.map((iso) => ({ starts_at: iso, status: "open" })),
    { onConflict: "starts_at", ignoreDuplicates: true },
  );
  if (seedErr) return { ok: false, error: "DB" };
  // 원자적 잠금: open 인 것만 booked 로. 하나라도 booked/blocked 면 개수 부족 → 충돌.
  const { data: locked } = await sb
    .from("availability_slots")
    .update({ status: "booked" })
    .in("starts_at", occIsos)
    .eq("status", "open")
    .select("id, starts_at");
  const lockedRows = (locked as { id: string; starts_at: string }[] | null) ?? [];
  if (lockedRows.length !== occIsos.length) {
    // 롤백
    await sb.from("availability_slots").update({ status: "open" })
      .in("id", lockedRows.map((r) => r.id));
    return { ok: false, error: "SLOT_TAKEN" };
  }
  const sortedLocked = [...lockedRows].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const confirmedSlotId = sortedLocked[0].id;
  const occupiedIds = sortedLocked.map((r) => r.id);

  // 4) 예약 insert (confirmed). 코드 충돌 재시도. 이메일 없음.
  let code = "";
  let inserted = false;
  for (let attempt = 0; attempt < 6 && !inserted; attempt++) {
    code = generateCode();
    const { error } = await sb.from("bookings").insert({
      code,
      customer_id: customerId,
      customer_name: name,
      customer_contact: contact,
      customer_email: email,
      referral_source: referral,
      services: lines,
      estimated_total: estimatedTotal,
      note: (input.note ?? "").trim(),
      status: "confirmed",
      confirmed_slot_id: confirmedSlotId,
      occupied_slot_ids: occupiedIds,
    });
    if (!error) inserted = true;
    else if (error.code !== "23505") {
      // 코드 중복이 아니면 실패 → 슬롯 롤백
      await sb.from("availability_slots").update({ status: "open" }).in("id", occupiedIds);
      return { ok: false, error: "DB" };
    }
  }
  if (!inserted) {
    await sb.from("availability_slots").update({ status: "open" }).in("id", occupiedIds);
    return { ok: false, error: "DB" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/customers");
  return { ok: true, code };
}
```

Note on the `bookings_one_confirmed_per_slot` unique index: it guards `confirmed_slot_id`. Since `confirmedSlotId` was just locked to `booked` from `open`, no other confirmed booking can hold it — the insert is safe. If a 23505 fires on the *booking* insert for the confirmed-slot index (not the code), treat as `SLOT_TAKEN`; the code-collision retry only catches `code`. To be precise, distinguish: on `error.code === "23505"`, retry only if the message references `bookings_code_key`/`code`; otherwise roll back slots and return `SLOT_TAKEN`. Keep the simple version if the message check is brittle — the earlier slot lock makes a confirmed-slot collision practically impossible in single-admin use.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → 0. `npm run lint` → 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/actions.ts
git commit -m "feat: createAdminBooking (instant confirmed, no email)"
```

---

### Task 6: Customer admin actions

**Files:**
- Modify: `src/app/admin/actions.ts`

**Interfaces:**
- Produces:
  - `createCustomer(input: { name: string; contact: string; email?: string; referral?: string; memo?: string }): Promise<{ ok: true; id: string; existed: boolean } | { ok: false; error: string }>` — insert; on duplicate `contact` return the existing id with `existed:true`.
  - `updateCustomer(input: { customerId: string; name?: string; email?: string; referral?: string; memo?: string }): Promise<ActionResult>` — partial update.
  - `findCustomerByContact(contact: string): Promise<{ id: string; name: string; contact: string; email: string; referral_source: string } | null>` — for the booking form's phone match.
- `saveCustomerMemo` stays (used by existing UI) — reimplement it to call the same update path, or leave as-is.

- [ ] **Step 1: Implement the three actions**

```ts
export async function createCustomer(input: {
  name: string; contact: string; email?: string; referral?: string; memo?: string;
}): Promise<{ ok: true; id: string; existed: boolean } | { ok: false; error: string }> {
  await assertAdmin();
  const name = (input.name ?? "").trim();
  const contact = (input.contact ?? "").trim();
  if (!name || !contact) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();
  const { data: existing } = await sb
    .from("customers").select("id").eq("contact", contact).maybeSingle();
  if (existing) {
    return { ok: true, id: (existing as { id: string }).id, existed: true };
  }
  const { data: created, error } = await sb
    .from("customers")
    .insert({
      name, contact,
      email: (input.email ?? "").trim(),
      referral_source: (input.referral ?? "").trim(),
      memo: (input.memo ?? "").trim(),
    })
    .select("id").single();
  if (error || !created) return { ok: false, error: "DB" };
  revalidatePath("/admin/customers");
  return { ok: true, id: (created as { id: string }).id, existed: false };
}

export async function updateCustomer(input: {
  customerId: string; name?: string; email?: string; referral?: string; memo?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  if (!input.customerId) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();
  const patch: Record<string, string> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.email !== undefined) patch.email = input.email.trim();
  if (input.referral !== undefined) patch.referral_source = input.referral.trim();
  if (input.memo !== undefined) patch.memo = input.memo.trim();
  const { error } = await sb.from("customers").update(patch).eq("id", input.customerId);
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/customers");
  return { ok: true };
}

export async function findCustomerByContact(
  contact: string,
): Promise<{ id: string; name: string; contact: string; email: string; referral_source: string } | null> {
  await assertAdmin();
  const c = (contact ?? "").trim();
  if (!c) return null;
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("customers")
    .select("id, name, contact, email, referral_source")
    .eq("contact", c).maybeSingle();
  return (data as { id: string; name: string; contact: string; email: string; referral_source: string } | null) ?? null;
}
```

- [ ] **Step 2: Point `saveCustomerMemo` at `updateCustomer` (optional DRY)**

Replace the body of `saveCustomerMemo` with `return updateCustomer({ customerId: input.customerId, memo: input.memo });` — keeps the existing `CustomersManager` call working. (Skip if you prefer zero churn.)

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` → 0. `npm run lint` → 0.

```bash
git add src/app/admin/actions.ts
git commit -m "feat: createCustomer / updateCustomer / findCustomerByContact actions"
```

---

### Task 7: Customer CRM UI (register + phone search + new/returning badge)

**Files:**
- Modify: `src/app/admin/customers/page.tsx`, `src/components/admin/CustomersManager.tsx`, `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `createCustomer`, `updateCustomer` (`@/app/admin/actions`). `CustomerRow` gains `isReturning: boolean`.

- [ ] **Step 1: Add i18n keys (ko + en)**

In `src/lib/i18n.ts`, add to the `admin` object for both locales. Korean:

```ts
    registerCustomer: "고객 등록",
    searchByPhone: "전화번호로 검색",
    badgeNew: "신규",
    badgeReturning: "재방문",
    customerName: "이름",
    customerContact: "전화 / 카톡",
    customerEmail: "이메일",
    saveCustomer: "저장",
    duplicateContact: "이미 등록된 연락처예요.",
```

English:

```ts
    registerCustomer: "Add customer",
    searchByPhone: "Search by phone",
    badgeNew: "New",
    badgeReturning: "Returning",
    customerName: "Name",
    customerContact: "Phone / Kakao",
    customerEmail: "Email",
    saveCustomer: "Save",
    duplicateContact: "This contact is already registered.",
```

- [ ] **Step 2: Add `isReturning` in the page**

In `src/app/admin/customers/page.tsx`, in the `rows` map add `isReturning: completed.length > 0,` to the returned object, and add `isReturning: boolean;` to `CustomerRow` in `CustomersManager.tsx`.

- [ ] **Step 3: Add register form + search to `CustomersManager`**

At the top of the `CustomersManager` component (before the empty-state check), add controlled search state and a register form. Concretely:
- Add `const [q, setQ] = useState("")` and filter `rows` by `r.contact.includes(q) || r.name.includes(q)` (case-insensitive) for display.
- Add a `RegisterCustomer` sub-component with `name`, `contact`, `email` inputs and a save button calling `createCustomer(...)`; on `{ ok:true, existed:true }` show `dict.admin.duplicateContact`; on success `router.refresh()`.
- Render a search `<input placeholder={dict.admin.searchByPhone}>` above the list.
- In `CustomerCard`, next to the name, render a badge: `row.isReturning ? dict.admin.badgeReturning : dict.admin.badgeNew` with distinct colors (e.g. returning `bg-brand-100 text-brand-700`, new `bg-amber-100 text-amber-700`).

Full new form component (add inside `CustomersManager.tsx`):

```tsx
function RegisterCustomer({ dict }: { dict: Dict }) {
  const a = dict.admin;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mb-3">
      <button onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white">
        + {a.registerCustomer}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-2xl border border-brand-100 bg-white p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={a.customerName}
            className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={a.customerContact}
            className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={a.customerEmail}
            className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
          {msg && <p className="text-xs text-amber-600">{msg}</p>}
          <button disabled={pending || !name.trim() || !contact.trim()}
            onClick={() => start(async () => {
              const res = await createCustomer({ name, contact, email });
              if (res.ok && res.existed) { setMsg(a.duplicateContact); return; }
              if (res.ok) { setName(""); setContact(""); setEmail(""); setOpen(false); router.refresh(); }
            })}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
            {a.saveCustomer}
          </button>
        </div>
      )}
    </div>
  );
}
```

Import `createCustomer` from `@/app/admin/actions`. Render `<RegisterCustomer dict={dict} />` and the search input above the list; move the empty-state so it only affects the list area (register + search stay visible when there are 0 customers).

- [ ] **Step 4: Verify (manual)**

Run `npm run dev`. At `/admin/customers`: register a customer (name+phone) → appears in the list with a **New** badge; a customer with completed bookings shows **Returning**; typing a phone fragment filters the list; registering an existing contact shows the duplicate message.
Run: `npx tsc --noEmit` → 0. `npm run lint` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/customers/page.tsx src/components/admin/CustomersManager.tsx src/lib/i18n.ts
git commit -m "feat: customer register, phone search, new/returning badge"
```

---

## Phase 2 — Unified calendar UI

### Task 8: Calendar data plumbing (blocks + services + customers)

**Files:**
- Modify: `src/lib/data.ts`, `src/app/admin/calendar/page.tsx`

**Interfaces:**
- Produces: `getBlocks(): Promise<{ block_group: string; starts_at: string; note_ko: string; note_en: string }[]>` — all `status='blocked'` slots that have a `block_group`, ordered by `starts_at`. The calendar page passes `blocks`, active `services`, and lightweight `customers` (id/name/contact) to `BookingCalendar`.

- [ ] **Step 1: Add `getBlocks` to `data.ts`**

```ts
export async function getBlocks(): Promise<
  { block_group: string; starts_at: string; note_ko: string; note_en: string }[]
> {
  if (!isSupabaseAdminConfigured()) return [];
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("availability_slots")
    .select("block_group, starts_at, note_ko, note_en")
    .eq("status", "blocked")
    .not("block_group", "is", null)
    .order("starts_at", { ascending: true });
  return (data as { block_group: string; starts_at: string; note_ko: string; note_en: string }[]) ?? [];
}
```

- [ ] **Step 2: Feed the calendar page**

In `src/app/admin/calendar/page.tsx`, extend the `Promise.all` to also fetch `getBlocks()`, `getAllServices()` (active filter can be done inline or add `getActiveServices()`), and `getCustomers()`. Pass new props to `BookingCalendar`: `blocks`, `services` (active only), `customers` (map to `{ id, name, contact }`). Import from `@/lib/data`.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` (will error until `BookingCalendar` accepts the new props — proceed to Task 9 in the same branch, or make the props optional now). To keep this task independently green, add the new props as **optional** in `BookingCalendar`'s prop type in this task (typed but unused), so tsc passes.

```bash
git add src/lib/data.ts src/app/admin/calendar/page.tsx src/components/admin/BookingCalendar.tsx
git commit -m "feat: fetch blocks/services/customers for admin calendar"
```

---

### Task 9: Block rendering + block form on the calendar day panel

**Files:**
- Create: `src/components/admin/BlockForm.tsx`
- Modify: `src/components/admin/BookingCalendar.tsx`, `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `blockRange`, `removeBlock` (`@/app/admin/actions`); `blocks` prop (Task 8).

- [ ] **Step 1: i18n keys**

Add to `admin` (ko / en): `addBlock: "블록 추가" / "Block time"`, `blockReason: "사유(선택)" / "Reason (optional)"`, `allDay: "하루 종일" / "All day"`, `from: "시작" / "From"`, `to: "종료" / "To"`, `removeBlock: "블록 해제" / "Remove block"`, `blockConflict: "이미 예약이 있는 시간이에요." / "That time already has a booking."`, `blocked: "블록" / "Blocked"`.

- [ ] **Step 2: Build `BlockForm.tsx`**

A client component that, given `dayKey` (YYYY-MM-DD) and locale, lets the admin pick start/end time (30-min `<select>`s, e.g. 08:00–21:00) or "all day", plus an optional reason, and calls `blockRange`. It builds the ISO list **client-side** from the local day + minute (matching `AvailabilityManager`'s existing 30-min generation), so timezone handling is consistent:

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { blockRange } from "@/app/admin/actions";

// dayKey: "YYYY-MM-DD"; builds local Date → ISO for each 30-min start in [startMin, endMin)
function isosFor(dayKey: string, startMin: number, endMin: number): string[] {
  const [y, m, d] = dayKey.split("-").map(Number);
  const out: string[] = [];
  for (let t = startMin; t < endMin; t += 30) {
    const dt = new Date(y, m - 1, d, Math.floor(t / 60), t % 60, 0, 0);
    out.push(dt.toISOString());
  }
  return out;
}

export function BlockForm({ dayKey, dict, onDone }: { dayKey: string; dict: Dict; onDone: () => void }) {
  const a = dict.admin;
  const router = useRouter();
  const [allDay, setAllDay] = useState(false);
  const [startMin, setStartMin] = useState(600); // 10:00
  const [endMin, setEndMin] = useState(720);      // 12:00
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const options: number[] = [];
  for (let t = 480; t <= 1320; t += 30) options.push(t); // 08:00–22:00
  const label = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

  function submit() {
    const s = allDay ? 480 : startMin;
    const e = allDay ? 1320 : endMin;
    if (e <= s) { setMsg(a.to); return; }
    start(async () => {
      const res = await blockRange({ startsAtISOs: isosFor(dayKey, s, e), reasonKo: reason, reasonEn: reason });
      if (!res.ok) { setMsg(res.error === "SLOT_TAKEN" ? a.blockConflict : "DB"); return; }
      onDone(); router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-brand-100 bg-white p-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> {a.allDay}
      </label>
      {!allDay && (
        <div className="flex items-center gap-2 text-sm">
          <select value={startMin} onChange={(e) => setStartMin(Number(e.target.value))}
            className="rounded-lg border border-brand-200 px-2 py-1">
            {options.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
          <span>–</span>
          <select value={endMin} onChange={(e) => setEndMin(Number(e.target.value))}
            className="rounded-lg border border-brand-200 px-2 py-1">
            {options.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </div>
      )}
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={a.blockReason}
        className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
      {msg && <p className="text-xs text-amber-600">{msg}</p>}
      <button disabled={pending} onClick={submit}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
        {a.addBlock}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Render blocks + entry points in `BookingCalendar`**

In `BookingCalendar.tsx`:
- Accept `blocks` prop; build `blocksByDay: Map<dayKey, {block_group, iso, note}[]>` using `slotDayKey`.
- In the month grid, add a small gray dot when `blocksByDay.has(key)` (distinct from status dots).
- In the selected-day panel, above the bookings list, render any blocks for `selected` with their time + reason and a **Remove block** button calling `removeBlock({ blockGroup })` then `router.refresh()` (add `useRouter`). Group consecutive slots of the same `block_group` into one row (min–max time).
- Add two buttons under the day heading: **➕ New booking** (Task 10) and **⛔ Block** that toggles `<BlockForm dayKey={selected} .../>`.

- [ ] **Step 4: Verify (manual)**

`npm run dev` → `/admin/calendar`: pick a day, add a 2-hour block with a reason → block row shows on the day and a gray dot on the month cell; those 30-min times disappear from the public booking wizard (`/`). Remove block → gone. Blocking a time that overlaps a confirmed booking → shows the conflict message.
`npx tsc --noEmit` → 0. `npm run lint` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/BlockForm.tsx src/components/admin/BookingCalendar.tsx src/lib/i18n.ts
git commit -m "feat: range block create/remove on admin calendar"
```

---

### Task 10: New-booking form on the calendar (with customer picker)

**Files:**
- Create: `src/components/admin/CustomerPicker.tsx`, `src/components/admin/NewBookingForm.tsx`
- Modify: `src/components/admin/BookingCalendar.tsx`, `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `createAdminBooking`, `findCustomerByContact` (`@/app/admin/actions`); `services`, `customers` props (Task 8).
- `CustomerPicker` produces a value: `{ id: string } | { name: string; contact: string; email?: string }`.

- [ ] **Step 1: i18n keys**

Add to `admin` (ko / en): `newBooking: "새 예약" / "New booking"`, `pickCustomer: "고객 선택" / "Choose customer"`, `orNewCustomer: "새 고객" / "New customer"`, `pickServices: "시술 선택" / "Services"`, `pickTime: "시간" / "Time"`, `createBooking: "예약 생성" / "Create booking"`, `bookingCreated: "예약이 생성됐어요." / "Booking created."`, `timeTaken: "그 시간은 이미 예약이 있어요." / "That time is already booked."`.

- [ ] **Step 2: Build `CustomerPicker.tsx`**

Client component with two modes: **existing** (a phone/name search input that calls `findCustomerByContact` on blur or filters the passed `customers` list) and **new** (name + contact + email inputs). It calls an `onChange(value)` prop with the current selection. Props: `{ customers: { id: string; name: string; contact: string }[]; dict: Dict; onChange: (v: { id: string } | { name: string; contact: string; email?: string } | null) => void }`. Keep it simple: a toggle between "기존 고객" (select/search from `customers`) and "새 고객" (three inputs). On existing selection emit `{ id }`; on new, emit `{ name, contact, email }` when both name+contact are non-empty, else `null`.

- [ ] **Step 3: Build `NewBookingForm.tsx`**

Client component. Props: `{ dayKey: string; services: Service[]; customers: {id;name;contact}[]; dict: Dict; locale: Locale; onDone: () => void }`. Contains:
- `<CustomerPicker>` → holds `customer` value.
- Service multi-select with quantity steppers (reuse the wizard's shape: an array of `{ service_id, quantity }`; show name + `formatServicePrice`). Compute total duration from selected services' `duration_min` for display.
- A time `<select>` of 30-min starts for `dayKey` (08:00–21:00) built the same way as `BlockForm.isosFor` (one ISO per option value).
- Optional note input.
- Submit → `createAdminBooking({ customer, services, startsAtISO, note })`. On `{ ok:false, error:"SLOT_TAKEN" }` show `dict.admin.timeTaken`; on success show `dict.admin.bookingCreated`, call `onDone()`, `router.refresh()`.

Guard submit disabled until `customer` is non-null, ≥1 service selected, and a time chosen.

- [ ] **Step 4: Wire into `BookingCalendar`**

Add a **➕ New booking** button on the selected-day panel that toggles `<NewBookingForm dayKey={selected} services={services} customers={customers} .../>`. Pass `services`/`customers` down from props (make them required now; page already provides them from Task 8).

- [ ] **Step 5: Verify (manual)**

`npm run dev` → `/admin/calendar`: pick a day → New booking → choose an existing customer (or enter a new one), pick One Color (90min) + time 2:00 PM → Create. The booking appears as **confirmed** on that day (green dot), the three 30-min slots become booked (gone from public wizard), the customer shows in `/admin/customers` (new one created). No email is sent. Creating over an already-booked time shows the conflict message. A brand-new customer's booking then shows **New** badge until completed.
`npx tsc --noEmit` → 0. `npm run lint` → 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/CustomerPicker.tsx src/components/admin/NewBookingForm.tsx src/components/admin/BookingCalendar.tsx src/lib/i18n.ts
git commit -m "feat: admin new-booking form on calendar (instant confirmed)"
```

---

### Task 11: Full-flow verification pass

**Files:** none (verification + any fixes surfaced).

- [ ] **Step 1: Regression tests**

Run: `npx vitest run` → all pure-helper tests PASS.
Run: `npx tsc --noEmit` → 0. `npm run lint` → 0. `npm run build` → succeeds.

- [ ] **Step 2: End-to-end manual script (dev server)**

1. Block tomorrow 12:00–14:00 with reason "점심" → verify public wizard can't pick those times.
2. Admin-create a booking tomorrow 15:00 for a NEW customer (One Color) → confirmed; customer created with **New** badge.
3. Complete that booking (existing complete flow) → customer flips to **Returning**, revenue updates.
4. Try to admin-book the same 15:00 slot again → `timeTaken` message.
5. Remove the lunch block → times reappear in public wizard.
6. Confirm no customer emails were sent for the admin booking (check logs / Resend dashboard).

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in full-flow verification"
```

---

## Self-Review Notes

- **Spec coverage:** range block + reason (Tasks 2,4,9) ✓; admin booking instant-confirmed, no email, rules ignored, overlap-only guard (Task 5,10) ✓; customer register/lookup by phone + new/returning auto (Tasks 6,7) ✓; unified calendar surface via evolving `BookingCalendar` (Tasks 8–10) ✓; `block_group` forward-compatible with recurring hours ✓.
- **No test framework existed** — added Vitest for pure logic only; DB/UI verified via tsc/lint/manual, matching repo reality.
- **Type consistency:** action names/signatures declared in Interfaces blocks and reused verbatim by later UI tasks (`createAdminBooking`, `blockRange`, `removeBlock`, `createCustomer`, `updateCustomer`, `findCustomerByContact`, `getBlocks`, `slotStartsForDuration`, `buildServiceLines`, `generateCode`).
- **Out of scope (next spec):** recurring business hours → auto slot generation.
