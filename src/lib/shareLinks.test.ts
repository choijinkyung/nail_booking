import { describe, expect, it } from "vitest";
import { bookingLink, bookLink, galleryLink } from "./shareLinks";

describe("shareLinks", () => {
  it("builds the public booking link", () => {
    expect(bookLink("https://zenna.com")).toBe("https://zenna.com/book");
  });

  it("builds the gallery link", () => {
    expect(galleryLink("https://zenna.com")).toBe("https://zenna.com/gallery");
  });

  it("builds a per-booking status link from the code", () => {
    expect(bookingLink("https://zenna.com", "AB12CD")).toBe(
      "https://zenna.com/status?code=AB12CD",
    );
  });

  it("strips a trailing slash from the base url", () => {
    expect(bookLink("https://zenna.com/")).toBe("https://zenna.com/book");
    expect(bookingLink("https://zenna.com/", "X1")).toBe(
      "https://zenna.com/status?code=X1",
    );
  });

  it("url-encodes codes that need it", () => {
    expect(bookingLink("https://zenna.com", "a b&c")).toBe(
      "https://zenna.com/status?code=a%20b%26c",
    );
  });

  it("returns a relative link when the base url is empty", () => {
    expect(bookLink("")).toBe("/book");
    expect(bookingLink("", "AB12CD")).toBe("/status?code=AB12CD");
  });
});
