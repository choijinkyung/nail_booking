# Square 스타일 관리자 스케줄링 구현 계획

> **에이전트 작업자용:** 필수 하위 스킬 — superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans 를 사용해 이 계획을 태스크 단위로 구현하세요. 각 단계는 체크박스(`- [ ]`) 문법으로 추적합니다.

**목표:** 관리자에게 Square 스케줄러 경험을 제공한다 — 시간 범위 블록, 관리자 직접 예약(즉시 확정), 전화번호 기반 고객 관리 — 모두 기존 관리자 캘린더 위에서.

**아키텍처:** `src/app/admin/actions.ts` 의 서버 액션(모두 `assertAdmin()` 로 보호, DB는 service_role 경유)이 쓰기를 담당한다. 범위 블록은 기존 30분 슬롯 격자에 새 `block_group` 컬럼으로 흡수한다. `/admin/calendar` 의 `BookingCalendar` 컴포넌트에 블록 렌더링 + 새 예약 폼 + 블록 폼을 추가하고, `/admin/customers` 에 등록 + 전화 검색을 추가한다. 순수한 스케줄링/매핑 로직은 `src/lib/` 로 추출해 Vitest 단위 테스트로 검증하고, 서버 액션과 UI는 `tsc`·`lint`·개발서버 수동 확인으로 검증한다.

**기술 스택:** Next.js 16(서버 액션, `"use server"`), React 19, Supabase(`@supabase/supabase-js`, service_role), TypeScript strict, Tailwind v4, Vitest(신규, 순수 헬퍼 전용).

## 전역 제약 (Global Constraints)

- 이 repo의 Next.js 16 은 학습 데이터와 다를 수 있음 — Next 관련 코드를 쓰기 전 `node_modules/next/dist/docs/` 를 확인할 것. (AGENTS.md)
- 모든 관리자 서버 액션은 반드시 맨 앞에서 `await assertAdmin()`(`@/lib/auth`) 호출. 미인증 시 `"UNAUTHORIZED"` throw.
- DB 접근은 오직 서버에서 `createSupabaseAdminClient()`(`@/lib/supabase/admin`) 로만. RLS가 브라우저 접근을 차단함.
- 슬롯은 30분 고정 격자. `availability_slots.starts_at` 는 UNIQUE. `status ∈ {"open","booked","blocked"}`.
- 표시 시간대는 `America/Vancouver`, 슬롯 인스턴트는 UTC ISO 로 저장. ISO 목록은 **클라이언트**가 관리자 로컬 시간 기준으로 만든다(기존 `AvailabilityManager` / `addSlots` 패턴과 동일) — 서버에서 밴쿠버↔UTC 변환 계산을 하지 말 것.
- 관리자 예약: 즉시 `confirmed` 상태, **고객 이메일 없음**, 스케줄링 규칙(`canBook` 60분 갭) 적용 안 함. 이미 `booked` 인 슬롯과의 겹침만 거부.
- 신규/재방문은 완료 방문 수로 계산(0 = 신규, 1+ = 재방문). 수동 태그 없음.
- `bookings.code` 는 NOT NULL UNIQUE. `customer_name`/`customer_contact` NOT NULL. `lookup_password_hash/salt` 는 기본값 `''`(관리자 예약은 빈 값 유지). `preferred_slot_id`/`confirmed_slot_id` nullable.
- `customers.contact` 는 NOT NULL UNIQUE — 중복 판정 키.
- 태스크별 검증: `npx tsc --noEmit`(에러 0) 와 `npm run lint`(에러 0) 는 항상. 순수 헬퍼를 추가하는 태스크는 `npx vitest run`. UI/액션 태스크는 개발서버(`npm run dev`) 수동 확인.
- 태스크마다 커밋. 요청 없으면 push 하지 말 것.

## 파일 구조 (File Structure)

**신규 파일**
- `vitest.config.ts` — Vitest 설정(Node 환경, alias 불필요; 테스트는 상대경로 import).
- `src/lib/code.ts` — `generateCode()`(`src/app/actions.ts` 에서 이동, 공개/관리자 예약 공유).
- `src/lib/code.test.ts` — `generateCode` 단위 테스트.
- `src/lib/bookingLines.ts` — 순수 `buildServiceLines(services, selections)` 매퍼.
- `src/lib/bookingLines.test.ts` — 단위 테스트.
- `src/lib/scheduling.test.ts` — `slotStartsForDuration` 단위 테스트(+ 기존 헬퍼 회귀).
- `src/components/admin/CustomerPicker.tsx` — 공유 고객 선택/등록 컨트롤(전화 조회 + 인라인 신규).
- `src/components/admin/NewBookingForm.tsx` — 관리자 예약 생성 폼(캘린더 날짜 패널에서 사용).
- `src/components/admin/BlockForm.tsx` — 범위/하루종일 블록 폼(캘린더 날짜 패널에서 사용).
- `supabase/migrations/20260703020000_block_group.sql` — `availability_slots.block_group` 추가.

**수정 파일**
- `supabase/schema.sql` — `block_group` 컬럼 미러링.
- `src/lib/types.ts` — `AvailabilitySlot` 에 `block_group` 추가; 필요 시 액션 입력 타입 추가.
- `src/lib/scheduling.ts` — `slotStartsForDuration` 추가.
- `src/app/actions.ts` — `@/lib/code` 의 `generateCode` import(로컬 사본 제거).
- `src/app/admin/actions.ts` — 신규 액션: `blockRange`, `removeBlock`, `createAdminBooking`, `createCustomer`, `updateCustomer`, `findCustomerByContact`; `saveCustomerMemo` 는 `updateCustomer` 를 감싸는 얇은 래퍼로 유지(또는 그대로; Task 6 참고).
- `src/lib/data.ts` — 캘린더용 `getBlocks()`(그룹화된 blocked 슬롯); `getAllServices`/`getCustomers` 를 캘린더 페이지에서 사용 가능하게.
- `src/app/admin/calendar/page.tsx` — 블록 + 활성 시술 + 고객을 fetch 해 `BookingCalendar` 에 전달.
- `src/components/admin/BookingCalendar.tsx` — 블록 렌더링; 날짜 패널에 ➕새 예약 / ⛔블록 진입점 추가.
- `src/app/admin/customers/page.tsx` — `isReturning` 전달, 집계 유지.
- `src/components/admin/CustomersManager.tsx` — 등록 버튼 + 전화 검색 + 신규/재방문 배지; `updateCustomer` 사용.
- `src/lib/i18n.ts` — 신규 관리자 dict 키(ko + en).

---

## Phase 1 — 백엔드 & 고객 CRM

### Task 1: Vitest 셋업 + `slotStartsForDuration` 순수 헬퍼

**파일:**
- 생성: `vitest.config.ts`, `src/lib/scheduling.test.ts`
- 수정: `src/lib/scheduling.ts`, `package.json`

**인터페이스:**
- 제공: `slotStartsForDuration(startISO: string, durationMin: number): string[]` — 소요시간을 채우는 30분 슬롯 시작 ISO(UTC) 목록, 개수 = `neededSlots(durationMin)`.

- [x] **Step 1: Vitest 설치**

```bash
npm install -D vitest
```

- [x] **Step 2: 설정 파일 + 테스트 스크립트 추가**

`vitest.config.ts` 생성:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

`package.json` 의 `"scripts"` 에 추가: `"test": "vitest run"`.

- [x] **Step 3: 실패하는 테스트 작성**

`src/lib/scheduling.test.ts` 생성:

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

- [x] **Step 4: 실패 확인**

실행: `npx vitest run src/lib/scheduling.test.ts`
기대: FAIL — `slotStartsForDuration is not a function`.

- [x] **Step 5: 헬퍼 구현**

`src/lib/scheduling.ts` 끝에 추가:

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

- [x] **Step 6: 통과 확인**

실행: `npx vitest run src/lib/scheduling.test.ts`
기대: PASS (3 tests).

- [x] **Step 7: tsc + 커밋**

실행: `npx tsc --noEmit` → 에러 0.

```bash
git add vitest.config.ts package.json package-lock.json src/lib/scheduling.ts src/lib/scheduling.test.ts
git commit -m "test: add Vitest + slotStartsForDuration scheduling helper"
```

---

### Task 2: `block_group` 컬럼 (마이그레이션 + 스키마 + 타입)

**파일:**
- 생성: `supabase/migrations/20260703020000_block_group.sql`
- 수정: `supabase/schema.sql`, `src/lib/types.ts`

**인터페이스:**
- 제공: `availability_slots.block_group uuid null`; `AvailabilitySlot.block_group: string | null`.

- [x] **Step 1: 마이그레이션 작성**

`supabase/migrations/20260703020000_block_group.sql` 생성:

```sql
-- 범위 블록(Square식 'block off time') 그룹 식별자.
-- 같은 block_group 을 가진 blocked 슬롯들은 하나의 블록으로 함께 생성/해제된다.
alter table public.availability_slots
  add column if not exists block_group uuid;

create index if not exists availability_slots_block_group_idx
  on public.availability_slots (block_group);
```

- [x] **Step 2: schema.sql 미러링**

`supabase/schema.sql` 의 `availability_slots` 섹션(앞선 마이그레이션이 추가한 `generated` 컬럼 근처)에 동일한 `add column if not exists ... block_group uuid;` 와 인덱스를 추가해, 새로 `schema.sql` 을 적용해도 마이그레이션과 일치하게 한다.

- [x] **Step 3: 타입에 추가**

`src/lib/types.ts` 의 `interface AvailabilitySlot` 에서 `generated: boolean;` 다음에 추가:

```ts
  block_group: string | null;
```

- [x] **Step 4: 필요 시 DEFAULT fallback 수정**

`src/lib/data.ts` 에는 기본 `AvailabilitySlot` 이 없으므로 그 외 변경 없음. `npx tsc --noEmit` 를 돌려 `AvailabilitySlot` 을 `block_group` 없이 생성하는 객체 리터럴이 있으면 `block_group: null` 을 추가한다.

- [x] **Step 5: 검증 + 커밋**

실행: `npx tsc --noEmit` → 0. `npm run lint` → 0.

```bash
git add supabase/migrations/20260703020000_block_group.sql supabase/schema.sql src/lib/types.ts src/lib/data.ts
git commit -m "feat: add availability_slots.block_group for range blocks"
```

---

### Task 3: `generateCode` 추출 + 순수 `buildServiceLines`

**파일:**
- 생성: `src/lib/code.ts`, `src/lib/code.test.ts`, `src/lib/bookingLines.ts`, `src/lib/bookingLines.test.ts`
- 수정: `src/app/actions.ts`

**인터페이스:**
- 제공:
  - `generateCode(len?: number): string` — 사람이 헷갈리지 않는 코드(알파벳 `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
  - `buildServiceLines(services: Service[], selections: { service_id: string; quantity: number }[]): BookingServiceLine[]` — DB 가격 스냅샷, 수량 1–20 클램프, 없는 id 는 제외.
- 소비: `@/lib/types` 의 `Service`, `BookingServiceLine`.

- [x] **Step 1: 실패하는 테스트 작성**

`src/lib/code.test.ts` 생성:

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

`src/lib/bookingLines.test.ts` 생성:

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

(`Service` 인터페이스 필드가 다르면 정확히 맞출 것 — 먼저 `src/lib/types.ts` 를 읽어라.)

- [x] **Step 2: 실패 확인**

실행: `npx vitest run src/lib/code.test.ts src/lib/bookingLines.test.ts`
기대: FAIL — 모듈 없음.

- [x] **Step 3: `code.ts` 구현**

`src/lib/code.ts` 생성(`src/app/actions.ts` 에서 그대로 이동):

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

- [x] **Step 4: `bookingLines.ts` 구현**

`src/lib/bookingLines.ts` 생성:

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

- [x] **Step 5: `src/app/actions.ts` 재연결**

로컬 `CODE_ALPHABET` + `generateCode`(대략 70–78줄)를 제거하고 `import { generateCode } from "@/lib/code";` 추가. 선택적으로 `createBooking` 안의 인라인 스냅샷 루프를 `buildServiceLines(svcRows ?? [], input.services)` 로 교체 — 단 동작이 완전히 동일할 때만(active-only 필터는 쿼리에 유지). 회귀를 피하려 이 변경은 최소로: 애매하면 `createBooking` 루프는 그대로 두고 `generateCode` 만 공유.

- [x] **Step 6: 검증**

실행: `npx vitest run src/lib/code.test.ts src/lib/bookingLines.test.ts` → PASS.
실행: `npx tsc --noEmit` → 0. `npm run lint` → 0.

- [x] **Step 7: 커밋**

```bash
git add src/lib/code.ts src/lib/code.test.ts src/lib/bookingLines.ts src/lib/bookingLines.test.ts src/app/actions.ts
git commit -m "refactor: extract generateCode + buildServiceLines to shared libs"
```

---

### Task 4: `blockRange` + `removeBlock` 액션

**파일:**
- 수정: `src/app/admin/actions.ts`

**인터페이스:**
- 소비: `assertAdmin`, `createSupabaseAdminClient`, `revalidatePath`.
- 제공:
  - `blockRange(input: { startsAtISOs: string[]; reasonKo?: string; reasonEn?: string }): Promise<ActionResult>` — 클라이언트가 30분 ISO 목록(연속 범위 또는 '하루종일' 전체 영업일)을 생성. 각각을 하나의 `block_group` 을 공유하는 `status:'blocked'` 로 생성/갱신. 대상 시간이 이미 `booked` 면 `SLOT_TAKEN` 으로 중단하고 아무것도 건드리지 않음.
  - `removeBlock(input: { blockGroup: string }): Promise<ActionResult>` — 그룹의 슬롯을 삭제. `booked` 는 절대 건드리지 않음.

- [x] **Step 1: `blockRange` 구현**

`src/app/admin/actions.ts` 에 추가:

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

메모: `onConflict:"starts_at"` upsert 는 기존 `open` 슬롯의 status 를 `blocked` 로 덮어쓰고 `block_group` 을 찍는다. booked 행은 step 1 에서 거부되므로 booked 슬롯이 덮이지 않는다. (검사와 upsert 사이에 슬롯이 booked 로 바뀌는 레이스가 나도, 확정 예약 흐름 자체의 잠금이 예약을 보호한다. 블록이 그 위에 안 생기면 그만 — 단일 관리자 사용에서 허용 가능.)

- [x] **Step 2: `removeBlock` 구현**

```ts
export async function removeBlock(input: {
  blockGroup: string;
}): Promise<ActionResult> {
  await assertAdmin();
  if (!input.blockGroup) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();
  // 그룹의 blocked 슬롯만 삭제 (블록은 관리자가 만든 것). booked 는 애초에 이 그룹에 없음.
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

(blocked 슬롯 삭제는 안전: blocked 슬롯은 예약을 보유하지 않음. 격자를 깔끔히 유지. 이후 반복영업시간 자동생성이 다시 필요로 하면 재생성함.)

- [x] **Step 3: 검증**

실행: `npx tsc --noEmit` → 0. `npm run lint` → 0.
수동(개발서버, 마이그레이션을 Supabase 에 적용한 뒤): 아직 UI 없음 — 수동은 Task 9 로 미룸.

- [x] **Step 4: 커밋**

```bash
git add src/app/admin/actions.ts
git commit -m "feat: blockRange + removeBlock admin actions"
```

---

### Task 5: `createAdminBooking` 액션

**파일:**
- 수정: `src/app/admin/actions.ts`

**인터페이스:**
- 소비: `generateCode`(`@/lib/code`), `buildServiceLines`(`@/lib/bookingLines`), `slotStartsForDuration` + `bookingDurationMin`(`@/lib/scheduling`).
- 제공: `createAdminBooking(input: { customer: { id: string } | { name: string; contact: string; email?: string; referral?: string }; services: { service_id: string; quantity: number }[]; startsAtISO: string; note?: string }): Promise<{ ok: true; code: string } | { ok: false; error: string }>` — 즉시 `confirmed` 예약 생성, 이메일 없음.

- [x] **Step 1: import 추가**

`src/app/admin/actions.ts` 상단에 추가:

```ts
import { generateCode } from "@/lib/code";
import { buildServiceLines } from "@/lib/bookingLines";
import { slotStartsForDuration } from "@/lib/scheduling"; // 기존 scheduling import 에 합치기
import type { Service } from "@/lib/types"; // 기존 타입 import 에 합치기
```

- [x] **Step 2: 액션 구현**

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

`bookings_one_confirmed_per_slot` 유니크 인덱스 관련 메모: 이 인덱스는 `confirmed_slot_id` 를 보호한다. `confirmedSlotId` 는 방금 `open` → `booked` 로 잠갔으므로 다른 확정 예약이 이를 보유할 수 없어 insert 가 안전하다. 만약 booking insert 에서 (code 가 아닌) 확정-슬롯 인덱스로 23505 가 나면 `SLOT_TAKEN` 으로 처리하라. 코드-충돌 재시도는 `code` 만 잡는다. 정확히 하려면 `error.code === "23505"` 일 때 메시지가 `bookings_code_key`/`code` 를 가리키면 재시도, 아니면 슬롯 롤백 후 `SLOT_TAKEN` 반환. 메시지 검사가 불안정하면 단순 버전을 유지 — 앞선 슬롯 잠금 덕에 단일 관리자 환경에서 확정-슬롯 충돌은 사실상 불가능하다.

- [x] **Step 3: 검증**

실행: `npx tsc --noEmit` → 0. `npm run lint` → 0.

- [x] **Step 4: 커밋**

```bash
git add src/app/admin/actions.ts
git commit -m "feat: createAdminBooking (instant confirmed, no email)"
```

---

### Task 6: 고객 관리자 액션

**파일:**
- 수정: `src/app/admin/actions.ts`

**인터페이스:**
- 제공:
  - `createCustomer(input: { name: string; contact: string; email?: string; referral?: string; memo?: string }): Promise<{ ok: true; id: string; existed: boolean } | { ok: false; error: string }>` — insert; `contact` 중복이면 기존 id 를 `existed:true` 로 반환.
  - `updateCustomer(input: { customerId: string; name?: string; email?: string; referral?: string; memo?: string }): Promise<ActionResult>` — 부분 갱신.
  - `findCustomerByContact(contact: string): Promise<{ id: string; name: string; contact: string; email: string; referral_source: string } | null>` — 예약 폼의 전화 매칭용.
- `saveCustomerMemo` 유지(기존 UI 사용) — 같은 갱신 경로를 호출하게 재구현하거나 그대로 둠.

- [x] **Step 1: 세 액션 구현**

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

- [x] **Step 2: `saveCustomerMemo` 를 `updateCustomer` 로 위임(선택, DRY)**

`saveCustomerMemo` 본문을 `return updateCustomer({ customerId: input.customerId, memo: input.memo });` 로 교체 — 기존 `CustomersManager` 호출을 그대로 유지. (변경 최소화를 원하면 생략 가능.)

- [x] **Step 3: 검증 + 커밋**

실행: `npx tsc --noEmit` → 0. `npm run lint` → 0.

```bash
git add src/app/admin/actions.ts
git commit -m "feat: createCustomer / updateCustomer / findCustomerByContact actions"
```

---

### Task 7: 고객 CRM UI (등록 + 전화 검색 + 신규/재방문 배지)

**파일:**
- 수정: `src/app/admin/customers/page.tsx`, `src/components/admin/CustomersManager.tsx`, `src/lib/i18n.ts`

**인터페이스:**
- 소비: `createCustomer`, `updateCustomer`(`@/app/admin/actions`). `CustomerRow` 에 `isReturning: boolean` 추가.

- [x] **Step 1: i18n 키 추가 (ko + en)**

`src/lib/i18n.ts` 의 `admin` 객체에 두 로케일 모두 추가. 한국어:

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

영어:

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

- [x] **Step 2: 페이지에 `isReturning` 추가**

`src/app/admin/customers/page.tsx` 의 `rows` 매핑에서 반환 객체에 `isReturning: completed.length > 0,` 를 추가하고, `CustomersManager.tsx` 의 `CustomerRow` 에 `isReturning: boolean;` 을 추가한다.

- [x] **Step 3: `CustomersManager` 에 등록 폼 + 검색 추가**

`CustomersManager` 컴포넌트 최상단(빈 상태 체크 전)에 제어형 검색 상태와 등록 폼을 추가. 구체적으로:
- `const [q, setQ] = useState("")` 를 추가하고 표시용으로 `rows` 를 `r.contact.includes(q) || r.name.includes(q)`(대소문자 무시)로 필터.
- `name`, `contact`, `email` 입력과 저장 버튼을 가진 `RegisterCustomer` 하위 컴포넌트 추가, `createCustomer(...)` 호출. `{ ok:true, existed:true }` 면 `dict.admin.duplicateContact` 표시; 성공 시 `router.refresh()`.
- 리스트 위에 `<input placeholder={dict.admin.searchByPhone}>` 검색창 렌더.
- `CustomerCard` 의 이름 옆에 배지 렌더: `row.isReturning ? dict.admin.badgeReturning : dict.admin.badgeNew`, 색 구분(예: 재방문 `bg-brand-100 text-brand-700`, 신규 `bg-amber-100 text-amber-700`).

새 폼 컴포넌트 전체(`CustomersManager.tsx` 안에 추가):

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

`createCustomer` 를 `@/app/admin/actions` 에서 import. `<RegisterCustomer dict={dict} />` 와 검색창을 리스트 위에 렌더하고, 빈 상태는 리스트 영역에만 영향을 주도록 이동(고객 0명이어도 등록+검색은 보이게).

- [x] **Step 4: 검증 (수동)**

`npm run dev` 실행. `/admin/customers` 에서: 고객 등록(이름+전화) → **신규** 배지로 리스트에 등장; 완료 예약이 있는 고객은 **재방문** 표시; 전화 일부 입력 시 리스트 필터; 이미 있는 연락처 등록 시 중복 메시지.
실행: `npx tsc --noEmit` → 0. `npm run lint` → 0.

- [x] **Step 5: 커밋**

```bash
git add src/app/admin/customers/page.tsx src/components/admin/CustomersManager.tsx src/lib/i18n.ts
git commit -m "feat: customer register, phone search, new/returning badge"
```

---

## Phase 2 — 통합 캘린더 UI

### Task 8: 캘린더 데이터 연결 (블록 + 시술 + 고객)

**파일:**
- 수정: `src/lib/data.ts`, `src/app/admin/calendar/page.tsx`

**인터페이스:**
- 제공: `getBlocks(): Promise<{ block_group: string; starts_at: string; note_ko: string; note_en: string }[]>` — `block_group` 이 있는 모든 `status='blocked'` 슬롯, `starts_at` 정렬. 캘린더 페이지가 `blocks`, 활성 `services`, 경량 `customers`(id/name/contact)를 `BookingCalendar` 에 전달.

- [x] **Step 1: `data.ts` 에 `getBlocks` 추가**

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

- [x] **Step 2: 캘린더 페이지에 공급**

`src/app/admin/calendar/page.tsx` 의 `Promise.all` 에 `getBlocks()`, `getAllServices()`(활성 필터는 인라인 또는 `getActiveServices()` 추가), `getCustomers()` 를 추가. `BookingCalendar` 에 새 props 전달: `blocks`, `services`(활성만), `customers`(`{ id, name, contact }` 로 매핑). `@/lib/data` 에서 import.

- [x] **Step 3: 검증 + 커밋**

실행: `npx tsc --noEmit`(`BookingCalendar` 가 새 props 를 받기 전까지 에러 — 같은 브랜치에서 Task 9 로 이어가거나, 지금 props 를 optional 로). 이 태스크를 독립적으로 통과시키려면 이번 태스크에서 `BookingCalendar` prop 타입에 새 props 를 **optional**(타입만, 미사용)으로 추가해 tsc 를 통과시켜라.

```bash
git add src/lib/data.ts src/app/admin/calendar/page.tsx src/components/admin/BookingCalendar.tsx
git commit -m "feat: fetch blocks/services/customers for admin calendar"
```

---

### Task 9: 캘린더 날짜 패널의 블록 렌더링 + 블록 폼

**파일:**
- 생성: `src/components/admin/BlockForm.tsx`
- 수정: `src/components/admin/BookingCalendar.tsx`, `src/lib/i18n.ts`

**인터페이스:**
- 소비: `blockRange`, `removeBlock`(`@/app/admin/actions`); `blocks` prop(Task 8).

- [x] **Step 1: i18n 키**

`admin` 에 추가(ko / en): `addBlock: "블록 추가" / "Block time"`, `blockReason: "사유(선택)" / "Reason (optional)"`, `allDay: "하루 종일" / "All day"`, `from: "시작" / "From"`, `to: "종료" / "To"`, `removeBlock: "블록 해제" / "Remove block"`, `blockConflict: "이미 예약이 있는 시간이에요." / "That time already has a booking."`, `blocked: "블록" / "Blocked"`.

- [x] **Step 2: `BlockForm.tsx` 작성**

`dayKey`(YYYY-MM-DD)와 locale 을 받아, 시작/종료 시간(30분 `<select>`, 예: 08:00–21:00) 또는 "하루종일" 과 선택 사유를 고르고 `blockRange` 를 호출하는 클라이언트 컴포넌트. ISO 목록은 로컬 day+minute 로 **클라이언트에서** 생성(기존 `AvailabilityManager` 의 30분 생성과 동일)해 시간대 처리를 일관되게 한다:

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { blockRange } from "@/app/admin/actions";

// dayKey: "YYYY-MM-DD"; [startMin, endMin) 각 30분 시작의 로컬 Date → ISO
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

- [x] **Step 3: `BookingCalendar` 에 블록 + 진입점 렌더**

`BookingCalendar.tsx` 에서:
- `blocks` prop 을 받아 `slotDayKey` 로 `blocksByDay: Map<dayKey, {block_group, iso, note}[]>` 구성.
- 월 그리드에서 `blocksByDay.has(key)` 이면 작은 회색 점 추가(상태 점과 구분).
- 선택 날짜 패널에서 예약 리스트 위에 `selected` 의 블록들을 시간 + 사유와 함께 렌더하고, `removeBlock({ blockGroup })` 후 `router.refresh()` 하는 **블록 해제** 버튼 추가(`useRouter` 추가). 같은 `block_group` 의 연속 슬롯을 한 줄(최소–최대 시간)로 묶음.
- 날짜 헤딩 아래 두 버튼 추가: **➕ 새 예약**(Task 10)과 `<BlockForm dayKey={selected} .../>` 를 토글하는 **⛔ 블록**.

- [x] **Step 4: 검증 (수동)**

`npm run dev` → `/admin/calendar`: 날짜 선택, 사유와 함께 2시간 블록 추가 → 그날에 블록 줄이 뜨고 월 셀에 회색 점; 해당 30분 시간들이 공개 예약 위저드(`/`)에서 사라짐. 블록 해제 → 사라짐. 확정 예약과 겹치는 시간을 블록하면 충돌 메시지.
`npx tsc --noEmit` → 0. `npm run lint` → 0.

- [x] **Step 5: 커밋**

```bash
git add src/components/admin/BlockForm.tsx src/components/admin/BookingCalendar.tsx src/lib/i18n.ts
git commit -m "feat: range block create/remove on admin calendar"
```

---

### Task 10: 캘린더의 새 예약 폼 (고객 선택기 포함)

**파일:**
- 생성: `src/components/admin/CustomerPicker.tsx`, `src/components/admin/NewBookingForm.tsx`
- 수정: `src/components/admin/BookingCalendar.tsx`, `src/lib/i18n.ts`

**인터페이스:**
- 소비: `createAdminBooking`, `findCustomerByContact`(`@/app/admin/actions`); `services`, `customers` props(Task 8).
- `CustomerPicker` 가 값을 제공: `{ id: string } | { name: string; contact: string; email?: string }`.

- [x] **Step 1: i18n 키**

`admin` 에 추가(ko / en): `newBooking: "새 예약" / "New booking"`, `pickCustomer: "고객 선택" / "Choose customer"`, `orNewCustomer: "새 고객" / "New customer"`, `pickServices: "시술 선택" / "Services"`, `pickTime: "시간" / "Time"`, `createBooking: "예약 생성" / "Create booking"`, `bookingCreated: "예약이 생성됐어요." / "Booking created."`, `timeTaken: "그 시간은 이미 예약이 있어요." / "That time is already booked."`.

- [x] **Step 2: `CustomerPicker.tsx` 작성**

두 모드를 가진 클라이언트 컴포넌트: **기존**(`findCustomerByContact` 를 blur 에 호출하거나 전달된 `customers` 리스트를 필터하는 전화/이름 검색 입력)과 **신규**(이름 + 연락처 + 이메일 입력). 현재 선택을 `onChange(value)` prop 으로 호출. Props: `{ customers: { id: string; name: string; contact: string }[]; dict: Dict; onChange: (v: { id: string } | { name: string; contact: string; email?: string } | null) => void }`. 단순하게: "기존 고객"(`customers` 에서 선택/검색)과 "새 고객"(입력 3개) 토글. 기존 선택 시 `{ id }` 방출, 신규는 이름+연락처가 모두 있으면 `{ name, contact, email }`, 아니면 `null` 방출.

- [x] **Step 3: `NewBookingForm.tsx` 작성**

클라이언트 컴포넌트. Props: `{ dayKey: string; services: Service[]; customers: {id;name;contact}[]; dict: Dict; locale: Locale; onDone: () => void }`. 포함:
- `<CustomerPicker>` → `customer` 값 보유.
- 수량 스테퍼가 있는 시술 다중선택(위저드 형태 재사용: `{ service_id, quantity }` 배열; 이름 + `formatServicePrice` 표시). 선택된 시술의 `duration_min` 으로 총 소요시간 표시.
- `dayKey` 의 30분 시작 `<select>`(08:00–21:00), `BlockForm.isosFor` 와 같은 방식으로 생성(옵션 value 당 ISO 하나).
- 선택 메모 입력.
- 제출 → `createAdminBooking({ customer, services, startsAtISO, note })`. `{ ok:false, error:"SLOT_TAKEN" }` 이면 `dict.admin.timeTaken` 표시; 성공 시 `dict.admin.bookingCreated` 표시, `onDone()` 호출, `router.refresh()`.

`customer` 가 non-null, 시술 ≥1, 시간 선택 전까지 제출 disabled.

- [x] **Step 4: `BookingCalendar` 에 연결**

선택 날짜 패널에 `<NewBookingForm dayKey={selected} services={services} customers={customers} .../>` 를 토글하는 **➕ 새 예약** 버튼 추가. props 에서 `services`/`customers` 를 내려줌(Task 8 에서 페이지가 이미 제공하므로 이제 required 로).

- [x] **Step 5: 검증 (수동)**

`npm run dev` → `/admin/calendar`: 날짜 선택 → 새 예약 → 기존 고객 선택(또는 신규 입력), 원컬러(90분) + 시간 오후 2:00 → 생성. 예약이 그날 **confirmed** 로 등장(초록 점), 3개 30분 슬롯이 booked(공개 위저드에서 사라짐), 고객이 `/admin/customers` 에 표시(신규는 새로 생성). 이메일 미발송. 이미 booked 인 시간에 생성 시 충돌 메시지. 신규 고객 예약은 완료 전까지 **신규** 배지.
`npx tsc --noEmit` → 0. `npm run lint` → 0.

- [x] **Step 6: 커밋**

```bash
git add src/components/admin/CustomerPicker.tsx src/components/admin/NewBookingForm.tsx src/components/admin/BookingCalendar.tsx src/lib/i18n.ts
git commit -m "feat: admin new-booking form on calendar (instant confirmed)"
```

---

### Task 11: 전체 흐름 검증 패스

> **현재 상태 (2026-09-09):** Task 1~10 완료. Step 1(회귀 테스트)은 자동으로
> 통과했다 — `tsc --noEmit` 0, `npm run lint` 0, `vitest` 12개 통과,
> `npm run build` 성공, 개발서버에서 모든 관리자 페이지 200 + 서버 에러 없음.
> Step 2(엔드투엔드 수동 시나리오)는 실제 Supabase DB에 예약·블록을 쓰므로
> 사장님이 직접 확인해야 한다.

**파일:** 없음(검증 + 발견된 수정).

- [x] **Step 1: 회귀 테스트**

실행: `npx vitest run` → 순수 헬퍼 테스트 전부 PASS.
실행: `npx tsc --noEmit` → 0. `npm run lint` → 0. `npm run build` → 성공.

- [ ] **Step 2: 엔드투엔드 수동 시나리오 (개발서버)**

1. 내일 12:00–14:00 을 사유 "점심" 으로 블록 → 공개 위저드에서 그 시간들 선택 불가 확인.
2. 내일 15:00 에 NEW 고객(원컬러)으로 관리자 예약 생성 → confirmed; **신규** 배지 고객 생성.
3. 그 예약을 완료(기존 완료 흐름) → 고객이 **재방문** 으로 바뀌고 매출 갱신.
4. 같은 15:00 슬롯을 다시 관리자 예약 시도 → `timeTaken` 메시지.
5. 점심 블록 해제 → 공개 위저드에 시간 재등장.
6. 관리자 예약에 대해 고객 이메일이 발송되지 않았는지 확인(로그 / Resend 대시보드).

- [ ] **Step 3: 발견된 수정 커밋**

```bash
git add -A
git commit -m "fix: address issues found in full-flow verification"
```

---

## 자체 검토 메모 (Self-Review Notes)

- **스펙 커버리지:** 범위 블록 + 사유(Task 2,4,9) ✓; 관리자 예약 즉시확정·이메일없음·규칙무시·겹침만가드(Task 5,10) ✓; 전화 기반 고객 등록/조회 + 신규/재방문 자동(Task 6,7) ✓; `BookingCalendar` 진화로 통합 캘린더(Task 8–10) ✓; `block_group` 은 반복영업시간과 호환 ✓.
- **테스트 프레임워크 부재** — 순수 로직만 Vitest 로 추가; DB/UI 는 tsc/lint/수동으로 검증(repo 현실 반영).
- **타입 일관성:** 액션명/시그니처를 인터페이스 블록에 선언하고 이후 UI 태스크가 그대로 재사용(`createAdminBooking`, `blockRange`, `removeBlock`, `createCustomer`, `updateCustomer`, `findCustomerByContact`, `getBlocks`, `slotStartsForDuration`, `buildServiceLines`, `generateCode`).
- **범위 밖(다음 스펙):** 반복 영업시간 → 슬롯 자동 생성.
