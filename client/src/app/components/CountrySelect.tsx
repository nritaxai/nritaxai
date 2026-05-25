import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { COUNTRY_OPTIONS } from "../utils/countries";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "./ui/utils";

type CountrySelectProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const countryToFlag = (code: string) =>
  code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

export function CountrySelect({
  value,
  onChange,
  disabled = false,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => COUNTRY_OPTIONS.find((country) => country.code === value),
    [value],
  );

  return (
    <div className="space-y-2.5">
      <label className="text-sm font-medium text-slate-800">
        Country of Residence <span className="text-[#2563eb]">*</span>
      </label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-14 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-[0_8px_25px_rgba(148,163,184,0.12)] transition-all",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/15",
              disabled ? "cursor-not-allowed opacity-60" : "hover:border-slate-300",
            )}
            aria-expanded={open}
            aria-label="Select your country of residence"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                {selected ? countryToFlag(selected.code) : <Search className="size-4 text-slate-400" />}
              </div>
              <div className="min-w-0">
                <p className={cn("truncate text-sm font-medium", selected ? "text-slate-900" : "text-slate-400")}>
                  {selected ? selected.name : "Select your country"}
                </p>
                <p className="text-xs text-slate-500">
                  Determines tax rules, pricing, and eligibility
                </p>
              </div>
            </div>
            <ChevronsUpDown className="size-4 text-slate-400" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[min(92vw,420px)] rounded-[24px] border border-slate-200 bg-white p-0 shadow-[0_24px_60px_rgba(15,23,42,0.16)]"
        >
          <Command className="rounded-[24px] bg-white">
            <div className="border-b border-slate-200 px-2 py-2">
              <CommandInput
                placeholder="Search country"
                className="h-11 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <CommandList className="max-h-[320px] p-2">
              <CommandEmpty className="py-8 text-slate-500">
                No country found.
              </CommandEmpty>
              <CommandGroup>
                {COUNTRY_OPTIONS.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={`${country.name} ${country.code}`}
                    onSelect={() => {
                      onChange(country.code);
                      setOpen(false);
                    }}
                    className="rounded-2xl px-3 py-3 text-slate-800 data-[selected=true]:bg-slate-100"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="text-xl">{countryToFlag(country.code)}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{country.name}</p>
                        <p className="text-xs text-slate-500">{country.code}</p>
                      </div>
                    </div>
                    <Check className={cn("size-4 text-[#2563eb]", value === country.code ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs leading-5 text-slate-500">
        Country selection determines tax rules, pricing, and subscription eligibility.
      </p>
    </div>
  );
}
