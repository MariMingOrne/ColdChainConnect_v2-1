import { Eye, Trash2 } from "lucide-react";

interface ActionButtonsProps {
  onView?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showDelete?: boolean;
  size?: "sm" | "md";
}

export function ActionButtons({
  onView,
  onEdit,
  onDelete,
  showDelete = true,
  size = "sm",
}: ActionButtonsProps) {
  const buttonClasses = {
    sm: "p-1.5",
    md: "p-2",
  };

  const iconClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  return (
    <div className="flex gap-2 items-center justify-center">
      {/* View Button */}
      {onView && (
        <button
          onClick={onView}
          className={`${buttonClasses[size]} bg-white border border-border text-navy rounded hover:bg-off-white transition-colors`}
          title="View details"
        >
          <Eye className={iconClasses[size]} />
        </button>
      )}

      {/* Edit Button */}
      <button
        onClick={onEdit}
        className={`${buttonClasses[size]} bg-gold text-white rounded font-semibold hover:opacity-90 transition-opacity`}
        title="Edit"
      >
        ✏️
      </button>

      {/* Delete Button - with toggle */}
      {showDelete && (
        <button
          onClick={onDelete}
          className={`${buttonClasses[size]} bg-red text-white rounded font-semibold hover:opacity-90 transition-opacity`}
          title="Delete"
        >
          <Trash2 className={iconClasses[size]} />
        </button>
      )}
    </div>
  );
}
