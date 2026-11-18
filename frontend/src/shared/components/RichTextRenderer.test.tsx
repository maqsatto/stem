import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { RichTextRenderer } from "./RichTextRenderer";

it("removes executable content from unsaved editor previews", () => {
  const { container } = render(<RichTextRenderer html={'<p>Safe</p><img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">link</a>'} />);
  expect(container.querySelector("p")?.textContent).toBe("Safe");
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")?.hasAttribute("onerror")).toBe(false);
  expect(container.querySelector("a")?.hasAttribute("href")).toBe(false);
});
