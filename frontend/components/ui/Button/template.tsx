import type { ButtonProps } from "./script";
import { getButtonClassName } from "./script";

export function ButtonTemplate({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={getButtonClassName(variant, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
