import React from 'react';
import { personName, roleLabel, readableDateTime } from '../../utils/people';

type Person = { full_name?: string | null; role?: string | null } | null | undefined;

/**
 * "Done by" cell. Each item is [action label | null, person, time]. Shows e.g.
 *   Approved: Teena (Finance Officer)
 *   4 Oct 2026, 10:42 AM
 */
export const DoneBy: React.FC<{ items: [string | null, Person, (string | null)?][] }> = ({ items }) => {
  const shown = items.filter(([, p]) => !!personName(p));
  if (shown.length === 0) return <span className="text-surface-300">—</span>;
  return (
    <div className="text-xs leading-snug space-y-1">
      {shown.map(([label, p, at], i) => (
        <div key={i}>
          <div className="whitespace-nowrap">
            {label && <span className="text-surface-400">{label}: </span>}
            <span className="font-semibold text-surface-800">{personName(p)}</span>
            {p?.role && <span className="text-surface-500"> ({roleLabel(p.role)})</span>}
          </div>
          {at && <div className="text-2xs text-surface-400">{readableDateTime(at)}</div>}
        </div>
      ))}
    </div>
  );
};
