# Component format — template / script / style

Feature components use a **Vue SFC–inspired** split (adapted for React):

```
ComponentName/
  index.tsx       # Entry — wires script → template
  template.tsx    # Markup only (JSX)
  script.ts       # Logic, hooks, handlers, types
  style.module.css # Scoped CSS (optional; Tailwind still used in template)
```

## Example

**`index.tsx`**
```tsx
"use client";
import { MyTemplate } from "./template";
import { useMyScript } from "./script";

export function MyComponent() {
  const props = useMyScript();
  return <MyTemplate {...props} />;
}
```

**`script.ts`** — state, API calls, event handlers  
**`template.tsx`** — presentational JSX, imports `style.module.css`  
**`style.module.css`** — component-specific classes

## Rules

- `template.tsx` has **no** `useState` / `useEffect` — only props and JSX
- `script.ts` exports a hook (e.g. `useBranchesPageScript`) returning props for the template
- Shared UI primitives (`components/ui/`) follow the same pattern when they have custom styles
- Global tokens stay in `app/globals.css`; use CSS modules for component-specific layout

## Reference implementations

- `components/features/branches/BranchesPage/`
- `components/ui/Button/`
