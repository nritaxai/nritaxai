import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface ShortFormLinkProps {
  shortForm: string;
  fullForm: string;
  className?: string;
}

export function ShortFormLink({ shortForm, fullForm, className = "" }: ShortFormLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline cursor-help underline decoration-dotted underline-offset-2 hover:text-blue-600 ${className}`}
          aria-label={`${shortForm} full form`}
        >
          {shortForm}
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="w-auto max-w-xs border border-[#E2E8F0] bg-white p-3 text-sm text-[#0F172A] shadow-md">
        <p>
          <span className="font-semibold">{shortForm}</span>: {fullForm}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
