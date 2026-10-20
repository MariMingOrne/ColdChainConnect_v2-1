import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  slow?: boolean;
}

export function LoadingSpinner({ className, slow = false }: LoadingSpinnerProps) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex min-h-40 flex-1 items-center justify-center", className)}>
      <LoaderCircle aria-hidden="true" className={cn("h-8 w-8 animate-spin text-accent-2", slow && "[animation-duration:1.8s]")} />
    </div>
  );
}
