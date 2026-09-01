"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { schoolYearLabel } from "@/lib/school-year";

export function SchoolYearSelect({
  value,
  options,
  onChange
}: {
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="school-year-picker">
      <span>Schuljahr</span>
      <span className="school-year-control">
        <CalendarRange aria-hidden="true" size={17} />
        <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
          {options.map((year) => (
            <option key={year} value={year}>
              {schoolYearLabel(year)}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" size={16} />
      </span>
    </label>
  );
}
