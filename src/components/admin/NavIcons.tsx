/**
 * 하단 탭 아이콘. 이모지는 기기마다 모양이 달라 앱처럼 보이지 않아서
 * 굵기가 일정한 선 아이콘으로 직접 그린다. (의존성 없음)
 */
const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconBookings() {
  return (
    <svg {...base}>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}

export function IconCalendar() {
  return (
    <svg {...base}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

export function IconCustomers() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.8c1.9.5 3 2.2 3 4.7" />
    </svg>
  );
}

export function IconHours() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconPrices() {
  return (
    <svg {...base}>
      <path d="M12 4.5v15M15.5 8c0-1.4-1.6-2.2-3.5-2.2S8.5 6.7 8.5 8.2c0 3.4 7 1.9 7 5.4 0 1.6-1.6 2.4-3.5 2.4s-3.5-.9-3.5-2.4" />
    </svg>
  );
}

export function IconGallery() {
  return (
    <svg {...base}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="m4.5 17 4.5-4.2 3.2 3 2.6-2.3 4.7 4" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" />
    </svg>
  );
}
