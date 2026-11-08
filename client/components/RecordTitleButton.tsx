import type { ReactNode } from "react";

interface RecordTitleButtonProps {
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

export function RecordTitleButton({ onClick, children, className = "" }: RecordTitleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="View details"
      className={`text-left font-semibold text-navy underline-offset-2 hover:text-accent-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2 ${className}`}
    >
      {children}
    </button>
  );
}
