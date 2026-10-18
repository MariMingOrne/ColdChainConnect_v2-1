import { Link } from "react-router-dom";
import type { SearchGroup } from "@/lib/globalSearch";

interface SearchResultGroupProps {
  group: SearchGroup;
}

export function SearchResultGroup({ group }: SearchResultGroupProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-navy/70">
        {group.label} ({group.hits.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {group.hits.map((hit) => (
          <li key={`${group.label}-${hit.id}`}>
            <Link
              to={hit.path}
              className="block bg-white border border-border rounded-lg px-4 py-3 hover:bg-navy/5 transition-colors"
            >
              <div className="font-semibold text-navy">{hit.title}</div>
              {hit.subtitle && <div className="text-sm text-navy/60">{hit.subtitle}</div>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
