"use client";

import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <Label htmlFor="fromDate">From</Label>
        <Input
          id="fromDate"
          type="date"
          value={fromDate}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="toDate">To</Label>
        <Input
          id="toDate"
          type="date"
          value={toDate}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
    </div>
  );
}
