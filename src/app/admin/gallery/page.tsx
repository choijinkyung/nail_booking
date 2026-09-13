import { redirect } from "next/navigation";

/**
 * 갤러리는 쓰지 않아 관리 화면에서 뺐다(작업 사진은 인스타그램으로 안내).
 * 옛 주소로 들어오면 예약 관리로 보낸다. 기능 자체는 코드에 남아 있어
 * 나중에 다시 쓰려면 탭만 되살리면 된다.
 */
export default function AdminGalleryPage() {
  redirect("/admin");
}
