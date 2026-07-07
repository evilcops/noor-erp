import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  error?: string;
}

export function Select({
  options,
  placeholder,
  error,
  className,
  ...props
}: SelectProps) {
  return (
    <div>
      <select
        className={cn(
          "h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
          error && "border-destructive",
          className
        )}
        {...props}
      >
        {placeholder ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
