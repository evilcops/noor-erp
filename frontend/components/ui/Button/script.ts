import type { ButtonHTMLAttributes } from "react";
import styles from "./style.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: string;
  loading?: boolean;
}

export function getButtonClassName(variant: ButtonVariant, className = ""): string {
  const resolved = variant === "outline" ? "secondary" : variant;
  const variantClass = styles[resolved] ?? styles.primary;
  return [styles.base, variantClass, className].filter(Boolean).join(" ");
}
