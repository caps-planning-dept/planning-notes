"use client";

import { Check } from "lucide-react";
import { readableTextOn, TAB_COLOR_PRESETS } from "@/lib/color";

type ColorPickerProps = {
  id: string;
  value: string | null;
  fallback: string;
  fallbackLabel?: string;
  onChange: (color: string | null) => void;
};

export function ColorPicker({ id, value, fallback, fallbackLabel, onChange }: ColorPickerProps) {
  const shown = value ?? fallback;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {TAB_COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${color} 색 선택`}
            aria-pressed={value === color}
            className="chamfer focus-inset flex size-9 items-center justify-center [--chamfer:8px]"
            style={{ background: color, color: readableTextOn(color) }}
            onClick={() => onChange(color)}
          >
            {value === color && <Check className="size-4" aria-hidden />}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label htmlFor={id} className="flex items-center gap-2">
          직접 선택
          <input
            id={id}
            type="color"
            value={shown}
            className="h-9 w-14 cursor-pointer rounded-md border bg-background p-1"
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        {fallbackLabel && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={value === null}
              onChange={(event) => onChange(event.target.checked ? null : fallback)}
            />
            {fallbackLabel}
          </label>
        )}
      </div>
    </div>
  );
}
