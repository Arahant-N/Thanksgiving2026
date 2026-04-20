"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DestinationOption } from "@/types/trip";

type DestinationSwitcherProps = {
  options: DestinationOption[];
  selectedId: string;
};

export function DestinationSwitcher({ options, selectedId }: DestinationSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (options.length <= 1) {
    return null;
  }

  return (
    <label className="destination-switcher">
      <span>Destination</span>
      <select
        className="destination-select"
        defaultValue={selectedId}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("city", event.currentTarget.value);
          const nextHref = params.toString() ? `${pathname}?${params.toString()}` : pathname;
          router.push(nextHref as never);
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
