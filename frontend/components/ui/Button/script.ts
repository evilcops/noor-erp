import type { ButtonHTMLAttributes } from "react";
import styles from "./style.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function getButtonClassName(variant: ButtonVariant, className = ""): string {
  const variantClass = styles[variant] ?? styles.primary;
  return [styles.base, variantClass, className].filter(Boolean).join(" ");
}
