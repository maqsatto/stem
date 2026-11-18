import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { PreferenceControls } from "@/shared/components/PreferenceControls";
import { PreferencesProvider } from "@/shared/preferences";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("color-scheme");
});

it("applies and remembers theme and language choices", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<PreferencesProvider><PreferenceControls /></PreferencesProvider>);
  await user.selectOptions(screen.getByLabelText("Тіл"), "en");
  await user.click(screen.getByLabelText("Switch to dark theme"));
  expect(document.documentElement.lang).toBe("en");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("mlstem-language")).toBe("en");
  expect(localStorage.getItem("mlstem-theme")).toBe("dark");
  unmount();
  render(<PreferencesProvider><PreferenceControls /></PreferencesProvider>);
  await waitFor(() => expect(screen.getByLabelText("Language")).toHaveValue("en"));
  expect(screen.getByLabelText("Switch to light theme")).toBeInTheDocument();
});
