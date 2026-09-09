"use client";

import { useEffect } from "react";
import { syncGeneratedSlots } from "@/app/admin/actions";

const KEY = "zenna_last_slot_sync";

/**
 * 관리자가 화면을 열 때 하루 한 번 예약 가능 시간을 다시 맞춘다.
 * 날이 가면 예약 창(오늘부터 N일)이 앞으로 밀려야 하는데, 저장 버튼을
 * 누를 때만 동기화하면 창이 점점 짧아지기 때문이다.
 * 조용히 실패해도 된다 — 화면에서 언제든 "다시 맞추기"로 수동 실행할 수 있다.
 */
export function AutoSync({ today }: { today: string }) {
  useEffect(() => {
    let done = "";
    try {
      done = window.localStorage.getItem(KEY) ?? "";
    } catch {
      // 저장소를 못 쓰는 브라우저 — 이번 한 번만 돌고 만다.
    }
    if (done === today) return;

    void (async () => {
      try {
        const res = await syncGeneratedSlots();
        if (!res.ok) return;
        window.localStorage.setItem(KEY, today);
      } catch {
        // 무시 — 다음 방문에 다시 시도한다.
      }
    })();
  }, [today]);

  return null;
}
