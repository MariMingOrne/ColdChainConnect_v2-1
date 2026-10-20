import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex min-h-40 flex-1 items-center justify-center", className)}>
      <LoaderCircle aria-hidden="true" className="h-8 w-8 animate-spin text-accent-2" />
    </div>
  );
}
