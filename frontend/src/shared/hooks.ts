import { useEffect, useState } from "react";

export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ML + STEM LAB` : "ML + STEM LAB";
  }, [title]);
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
