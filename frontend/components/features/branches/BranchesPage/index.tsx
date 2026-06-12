"use client";

import { BranchesPageTemplate } from "./template";
import { useBranchesPageScript } from "./script";

export function BranchesPage() {
  const props = useBranchesPageScript();
  return <BranchesPageTemplate {...props} />;
}
