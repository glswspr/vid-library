import { useState } from 'react';
import type { FC } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableTextProps {
  text: string;
  maxChars?: number;
}

const ExpandableText: FC<ExpandableTextProps> = ({ text, maxChars = 220 }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const isLong = typeof text === 'string' && text.length > maxChars;

  return (
    <div>
      <p className="text-sm text-slate-400 max-w-2xl">
        {isLong && !expanded ? `${text.slice(0, maxChars).trimEnd()}…` : text}
      </p>
      {isLong && (
        <button
          key="expand-toggle"
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold mt-1 cursor-pointer"
        >
          {expanded ? <>Show less <ChevronUp className="w-3.5 h-3.5" /></> : <>Show more <ChevronDown className="w-3.5 h-3.5" /></>}
        </button>
      )}
    </div>
  );
};

export default ExpandableText;
