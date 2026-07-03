declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  interface AutoTableOptions {
    startY?: number;
    head?: string[][];
    body?: (string | number)[][];
    theme?: string;
    headStyles?: Record<string, unknown>;
    styles?: Record<string, unknown>;
    margin?: { left?: number; right?: number };
  }

  export default function autoTable(doc: jsPDF, options: AutoTableOptions): void;
}
