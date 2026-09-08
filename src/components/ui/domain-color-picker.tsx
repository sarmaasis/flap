import { Check } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "../../lib/utils";

/** Preset chip colors for domains (avoid pure accent orange so chips stay distinct). */
export const DOMAIN_COLOR_PRESETS = [
  "#0a7b6f",
  "#2a78d6",
  "#c47a10",
  "#8b3a62",
  "#4a5568",
  "#b42318",
  "#5c5652",
  "#141211",
  "#0d9488",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
] as const;

export function DomainColorPicker({
  color,
  label,
  onChange,
  disabled,
}: {
  color?: string | null;
  label: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const current =
    color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DOMAIN_COLOR_PRESETS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 gap-2 px-2.5"
          aria-label={label}
        >
          <span
            className="h-4 w-4 shrink-0 rounded-md border border-[var(--line-strong)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
            style={{ background: current }}
            aria-hidden
          />
          <span className="text-[var(--foreground-muted)]">Color</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto p-3">
        <DropdownMenuLabel className="px-0 pb-2 pt-0">Inbox color</DropdownMenuLabel>
        <div className="grid grid-cols-6 gap-2" role="listbox" aria-label={label}>
          {DOMAIN_COLOR_PRESETS.map((hex) => {
            const selected = current.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={`Set color ${hex}`}
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                  selected && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]",
                )}
                style={{ background: hex }}
                onClick={() => onChange(hex)}
              >
                {selected ? <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} /> : null}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
