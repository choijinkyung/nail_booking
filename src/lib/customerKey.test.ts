import { describe, expect, it } from "vitest";
import { isUsablePhone, sameCustomer } from "./customerKey";

describe("isUsablePhone", () => {
  it("숫자 8자리 이상이면 사람을 가릴 수 있는 번호로 본다", () => {
    expect(isUsablePhone("604-123-4567")).toBe(true);
    expect(isUsablePhone("+1 604 123 4567")).toBe(true);
    expect(isUsablePhone("010-1234-5678")).toBe(true);
  });

  it("자리를 채우려고 넣은 값은 번호로 보지 않는다", () => {
    expect(isUsablePhone("0")).toBe(false);
    expect(isUsablePhone("123")).toBe(false);
    expect(isUsablePhone("1234567")).toBe(false);
    expect(isUsablePhone("")).toBe(false);
    expect(isUsablePhone("카톡아이디")).toBe(false);
  });
});

describe("sameCustomer", () => {
  it("제대로 된 번호가 같으면 이름이 달라도 같은 사람", () => {
    // 결혼 등으로 이름이 바뀌어도 번호가 같으면 같은 손님이다
    expect(
      sameCustomer(
        { name: "김영진", contact: "604-123-4567" },
        { name: "김영진A", contact: "6041234567" },
      ),
    ).toBe(true);
  });

  it("번호가 다르면 이름이 같아도 다른 사람", () => {
    expect(
      sameCustomer(
        { name: "김영진", contact: "6041234567" },
        { name: "김영진", contact: "6041234568" },
      ),
    ).toBe(false);
  });

  it("번호가 '0' 같은 값이면 이름까지 같아야 같은 사람", () => {
    expect(
      sameCustomer({ name: "한수민", contact: "0" }, { name: "김영진", contact: "0" }),
    ).toBe(false);
    expect(
      sameCustomer({ name: "한수민", contact: "0" }, { name: "한수민", contact: "0" }),
    ).toBe(true);
  });

  it("이름 비교는 앞뒤 공백과 대소문자를 무시한다", () => {
    expect(
      sameCustomer({ name: " Hwi ", contact: "0" }, { name: "hwi", contact: "0" }),
    ).toBe(true);
  });
});
