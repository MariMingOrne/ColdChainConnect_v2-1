import { useEffect, useState } from "react";

export function useReportData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem("auth_token") || "";

    fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load report data (HTTP ${response.status}).`);
        setData((await response.json()) as T);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Report data could not be loaded.");
      });

    return () => controller.abort();
  }, [path]);

  return { data, error };
}
