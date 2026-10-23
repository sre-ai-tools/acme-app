import { useEffect } from "react";

/** Sets document.title, which screen readers announce after a route change. */
export function usePageTitle(title: string | undefined): void {
  useEffect(() => {
    if (title) document.title = `${title} · Incident Log`;
  }, [title]);
}
