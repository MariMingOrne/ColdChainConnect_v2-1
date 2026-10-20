import { LoaderCircle } from "lucide-react";

export function PostLoginLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-off-white"
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy shadow-lg">
          <LoaderCircle size={30} className="animate-spin [animation-duration:2s] text-white" />
        </div>
        <div>
          <p className="font-rajdhani text-2xl font-bold text-navy">ACDP</p>
          <p className="mt-1 text-sm text-muted">Preparing your workspace…</p>
        </div>
      </div>
    </div>
  );
}
