import { redirect } from "next/navigation";

/** 캘린더는 예약 관리(/admin)로 합쳐졌다. 옛 주소로 들어오면 그리로 보낸다. */
export default function AdminCalendarPage() {
  redirect("/admin");
}
