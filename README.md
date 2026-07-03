# 💅 Zenna Nail

사업자 등록 없이 **집에서 프리랜서로 네일을 하는 분**을 위한 예약·CS 관리 앱입니다.
구글 예약 같은 사업자용 시스템을 쓸 수 없는 개인을 위해 만들었어요.
디자인 무드: **Nude / Quiet Luxury (모카·에스프레소)**.

기본 메뉴: 원컬러(젤네일) $35 · 프렌치 $45 · 연장 손가락당 $5 · 제거 $5 (관리자가 언제든 수정)

- 📱 **모바일 우선 · 반응형**
- 🇰🇷🇺🇸 **한국어 / 영어 전환**
- 🗓️ **요청 후 승인** 방식 (샵 출퇴근으로 시간이 유동적인 상황에 맞춤)
- 🔒 **중복 예약 원천 차단** (DB 레벨 + 조건부 잠금 이중 방어)
- ⚠️ **안내사항 강조** (반려동물 알러지 등을 눈에 띄게 + 예약 시 동의 필수)
- 🖼️ **시술 사진 갤러리** (카테고리별) — 손님이 열람, 관리자가 업로드
- 🔁 **손님 변경/취소 "요청"** → **관리자 승인 시에만** 실제 반영 (손님·관리자 양쪽 이메일 알림)
- 📅 **관리자 캘린더** — 누가·몇 시에·무슨 시술을 예약했는지 월별로 확인
- 💵 결제 안내(현금 / e-transfer), 위치 안내, 가격표 관리 — 모두 관리자가 수정

## 기술 스택
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Storage) · Resend(이메일, 선택)
관리자 로그인은 Supabase Auth 대신 **환경변수 기반 이름+비밀번호(HMAC 쿠키 세션)** 를 사용합니다.

---

## 🚀 처음 설정 (약 10분)

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 무료 프로젝트 생성
2. 왼쪽 메뉴 **SQL Editor** → **New query** → 이 저장소의 [`supabase/schema.sql`](supabase/schema.sql) 내용을 붙여넣고 **Run**
   - 테이블(services, availability_slots, bookings, settings) + 기본 가격표 + 중복예약 방지 인덱스가 생성됩니다.
3. **Settings → API** 에서 아래 값 3개를 복사해 둡니다.
   - `Project URL`
   - `anon` `public` key
   - `service_role` `secret` key ← 서버 전용, 절대 외부 노출 금지

### 2. 환경변수 채우기
[`.env.local`](.env.local) 파일을 열어 값을 채웁니다. (`.env.example` 참고)

```bash
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="ey...."
SUPABASE_SERVICE_ROLE_KEY="ey...."   # service_role (secret)

# 관리자 로그인 (영문 이름 + 비밀번호로 /admin 접속) — Supabase 유저 생성 불필요!
ADMIN_FIRST_NAME="Jinkyung"
ADMIN_LAST_NAME="Choi"
ADMIN_PASSWORD="원하는-비밀번호"
ADMIN_SESSION_SECRET="아무-긴-랜덤문자열"   # 예: 터미널에서  openssl rand -hex 32
```

> 관리자 로그인은 이제 **영문 이름(First/Last) + 비밀번호**로 합니다. Supabase에 유저를 따로 만들 필요가 없어요. 위에 적은 이름·비밀번호로 `/admin/login` 에서 로그인합니다.

### 3. (선택) 이메일 알림 켜기
새 예약 요청을 이메일로 받고 싶다면:
1. https://resend.com 에서 API Key 발급
2. `.env.local` 에 추가
   ```bash
   RESEND_API_KEY="re_..."
   ADMIN_NOTIFICATION_EMAIL="사장님이메일@example.com"   # 알림 받을 주소
   EMAIL_FROM="Zenna Nail <onboarding@resend.dev>"     # 도메인 인증 전엔 이 값 사용 가능
   ```
> 값이 비어 있으면 이메일은 자동으로 건너뛰고, **관리자 대시보드 알림은 계속 동작**합니다.

### 4. 실행
```bash
npm install
npm run dev       # http://localhost:3000
```

> Supabase/관리자 값을 채우기 전에도 앱은 실행됩니다. (설정 안내가 표시됨)

---

## 📖 사용 방법

### 고객 (로그인 불필요)
- **`/`** 소개·주의사항·가격표·위치
- **`/book`** 시술 선택 → 1지망 + 대체 시간 선택 → 정보 입력(+ **예약 확인용 비밀번호**) → 안내 동의 → 요청
  - 요청 완료 시 **조회 코드**(예: `3F9K2P`)를 받습니다.
- **`/status`** 예약 조회 — **예약번호** 또는 **이름 + 비밀번호** 로 확인. 진행 상황(확인 중 / 확정 / 불가) + **변경/취소 요청**
  - 💳 **결제(e-transfer) 안내는 관리자가 "시술 완료"를 누른 뒤에** 이 화면에 표시됩니다.
  - 변경 요청 시 새 시간은 **사장님이 연 시간(open)** 중에서만 고를 수 있어요.
- **`/gallery`** 시술 사진 갤러리 (카테고리 탭으로 필터)

### 관리자 (사장님)
- **`/admin`** 예약 관리 — 대기 요청 확정 / 다른 시간 제안 / 불가 안내. 상단에 **손님 변경·취소 요청**이 모여 보이고, 버튼으로 승인/반려. (승인해야만 실제 반영, 손님에게 이메일 통보)
- **`/admin/calendar`** 월별 캘린더로 예약 현황(고객·시간·시술) 확인
- **`/admin/availability`** 예약 가능 시간대 추가 / 막기 / 삭제
- **`/admin/services`** 가격표 수정 (원컬러·제거·연장 단가 등)
- **`/admin/gallery`** 시술 사진 업로드 / 카테고리 지정 / 삭제
- **`/admin/settings`** 상호·위치·주의사항·결제 / e-transfer 정보 수정

> 갤러리 사진은 Supabase Storage 의 공개 버킷 `gallery` 에 저장됩니다. `schema.sql` 실행 시 버킷도 함께 생성돼요.

---

## 🔒 중복 예약이 막히는 원리
1. 확정 시, 해당 시간대를 `open → booked` 로 **조건부 업데이트** — 이미 예약된 시간이면 0행이 바뀌며 확정이 거부됩니다.
2. `bookings` 테이블에 **부분 유니크 인덱스**(`confirmed_slot_id` where status='confirmed')로 DB가 2차 차단.
3. 확정된 시간대는 고객 예약 화면과 시간 목록에서 자동으로 사라지고, 삭제도 막힙니다.

---

## ☁️ 배포 (Vercel 권장)
1. 이 프로젝트를 GitHub에 올리고 [Vercel](https://vercel.com)에서 Import
2. **Environment Variables** 에 `.env.local` 의 값들을 그대로 등록
   - (선택) `NEXT_PUBLIC_SITE_URL` 에 실제 도메인을 넣으면 이메일 링크가 정확해집니다.
3. Deploy 🚀

## 🔌 Supabase 연결 방식 — 어떤 pooler가 필요한가?
**이 앱 자체는 pooler(Direct/Session/Transaction) 연결 문자열이 전혀 필요 없습니다.**
앱은 Supabase JS 클라이언트로 **REST(HTTPS) API** 를 통해 접근하므로, 필요한 건 URL + anon key + service_role key 뿐이에요.

pooler는 **Postgres에 직접 연결하는 경우**(예: 마이그레이션 CI, Prisma/Drizzle 같은 ORM)에만 씁니다. 정리하면:

| 용도 | 무엇을 쓰나 |
|---|---|
| **앱 런타임** (이 프로젝트) | 아무 pooler도 필요 없음 — URL + 키만 |
| **DB 마이그레이션 CI** (`supabase db push`) | **Session pooler** 문자열 사용 (아래) |
| 서버리스에서 ORM 직접 연결 | Transaction pooler (port 6543) |
| 장기 실행 서버 / 로컬 psql | Direct 또는 Session pooler |

## 🚀 자동 배포 (push 하면 자동 반영)
- **코드 배포 (앱)**: [Vercel](https://vercel.com)에서 이 repo를 한 번 Import 하면, 이후 `main` 에 **push 할 때마다 자동 배포**됩니다. (PR은 프리뷰 배포) — 별도 설정 불필요.
- **DB 배포 (스키마 변경)**: `.github/workflows/db-migrate.yml` 이 `supabase/migrations/**` 변경을 감지해 push 시 **Supabase DB에 자동 적용**합니다.
  - 스키마를 바꾸려면 `supabase/migrations/` 에 새 `.sql` 파일을 추가하고 push 하세요.
  - **필요한 GitHub Secret 1개** (repo → Settings → Secrets and variables → Actions → New):
    - `SUPABASE_DB_URL` = Supabase → Project Settings → Database → Connection string → **Session pooler** 문자열 (`[YOUR-PASSWORD]` 를 실제 DB 비밀번호로 치환)

## 🌐 도메인 바꿀 수 있나요? — 네!
- **무료 기본 주소**: Vercel 배포 시 `프로젝트이름.vercel.app` 이 자동으로 생겨요. 프로젝트 이름을 바꾸면 이 주소도 바뀝니다. (Vercel → Project → Settings → General / Domains)
- **내 도메인 연결**: `zennanail.com` 같은 도메인을 구입(가비아·Namecheap·GoDaddy 등)한 뒤, Vercel → Settings → **Domains → Add** 에서 연결하면 됩니다. (DNS 설정은 Vercel이 안내)
- 도메인을 바꾸면 이메일 링크가 정확하도록 Vercel 환경변수에 `NEXT_PUBLIC_SITE_URL="https://내도메인"` 을 넣어주세요.

## 🔧 CI · Docker · 보안
- **CI**: `.github/workflows/ci.yml` — push/PR 마다 lint + 타입체크 + 빌드 검증. (Supabase 시크릿은 빌드에 불필요)
- **Docker**(선택, 자가 호스팅용): `docker build -t zenna-nail . && docker run -p 3000:3000 --env-file .env.local zenna-nail`
- **보안**:
  - 시크릿(`SUPABASE_SERVICE_ROLE_KEY` 등)은 `.env*`로 git에서 제외(`.env.example`만 커밋).
  - `service_role` 키는 `server-only`로 서버에서만 사용, 브라우저 노출 불가.
  - 보안 헤더(X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS 등) 적용.
  - 관리자 세션은 **HMAC 서명된 httpOnly 쿠키**(30일)로 관리하고, 각 서버 액션에서 `assertAdmin()`으로 검증.
  - 예약 확인용 비밀번호는 평문 저장하지 않고 **솔트 + SHA-256 해시**로 저장.

## 데이터 구조
- `services` 시술/가격 · `availability_slots` 가능 시간 · `bookings` 예약 요청 · `settings` 각종 안내(단일 행)
- 모든 DB 접근은 **서버(Server Actions)에서 service_role 키로만** 수행하며, 브라우저는 DB에 직접 접근하지 않습니다. (RLS 기본 차단)
- 시간은 밴쿠버(America/Vancouver) 기준으로 표시됩니다.
