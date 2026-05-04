# UI Component System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline styles and flat CSS classes with a shadcn/ui + Tailwind v4 component system using the Brand Gradient Dark theme, DM Sans font, and comfortable density.

**Architecture:** shadcn/ui generates accessible headless components into `frontend/components/ui/`. We style them with Tailwind v4 CSS custom properties (`@theme` block). Custom layout and domain components live in `frontend/components/layout/` and `frontend/components/domain/`. A ThemeProvider wraps the app for day/night mode. Existing pages are migrated last once all components exist.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, DM Sans (next/font/google), Lucide React, class-variance-authority, tailwind-merge, Vitest, @testing-library/react, jsdom

---

## File Map

**Create:**
- `frontend/vitest.config.ts` — test runner config
- `frontend/vitest.setup.ts` — RTL global setup
- `frontend/components/ui/button.tsx` — Button (gradient, ghost, danger, icon)
- `frontend/components/ui/input.tsx` — Input field
- `frontend/components/ui/textarea.tsx` — Textarea with char counter support
- `frontend/components/ui/select.tsx` — Select dropdown
- `frontend/components/ui/card.tsx` — Card (default, clickable)
- `frontend/components/ui/badge.tsx` — Badge base component
- `frontend/components/ui/avatar.tsx` — Avatar with fallback
- `frontend/components/ui/dialog.tsx` — Modal/Dialog
- `frontend/components/ui/toast.tsx` — Toast via Sonner
- `frontend/components/ui/dropdown-menu.tsx` — Dropdown menu
- `frontend/components/ui/tooltip.tsx` — Tooltip
- `frontend/components/ui/skeleton.tsx` — Skeleton loader
- `frontend/components/layout/Sidebar.tsx` — Responsive sidebar
- `frontend/components/layout/PageHeader.tsx` — Page title + action slot
- `frontend/components/layout/LoadingScreen.tsx` — Full-page auth spinner
- `frontend/components/layout/EmptyState.tsx` — Empty list placeholder
- `frontend/components/layout/OnboardingTooltip.tsx` — First-visit guided tip
- `frontend/components/domain/StatusBadge.tsx` — Post status colour badge
- `frontend/components/domain/BrandBadge.tsx` — Brand gradient badge
- `frontend/components/domain/PlatformPill.tsx` — Platform selector toggle
- `frontend/components/domain/CharacterCounter.tsx` — Live char count with limit
- `frontend/lib/utils.ts` — cn() utility
- `frontend/lib/theme.tsx` — ThemeProvider + useTheme hook
- `frontend/components.json` — shadcn/ui config (generated)
- `frontend/__tests__/ui/button.test.tsx`
- `frontend/__tests__/ui/input.test.tsx`
- `frontend/__tests__/ui/card.test.tsx`
- `frontend/__tests__/ui/badge.test.tsx`
- `frontend/__tests__/domain/StatusBadge.test.tsx`
- `frontend/__tests__/domain/BrandBadge.test.tsx`
- `frontend/__tests__/domain/PlatformPill.test.tsx`
- `frontend/__tests__/domain/CharacterCounter.test.tsx`

**Modify:**
- `frontend/app/globals.css` — replace flat CSS with `@theme` tokens + minimal base styles
- `frontend/app/layout.tsx` — add DM Sans font + ThemeProvider
- `frontend/app/dashboard/layout.tsx` — use new Sidebar + LoadingScreen
- `frontend/app/login/page.tsx` — use new Button + Input + Card
- `frontend/app/dashboard/page.tsx` — use new Card + Button + BrandBadge
- `frontend/app/dashboard/generate/page.tsx` — use new form components + PlatformPill + CharacterCounter
- `frontend/app/dashboard/posts/page.tsx` — use new Card + StatusBadge + BrandBadge
- `frontend/app/dashboard/calendar/page.tsx` — use new EmptyState
- `frontend/app/dashboard/leads/page.tsx` — use new EmptyState
- `frontend/app/dashboard/outreach/page.tsx` — use new EmptyState
- `frontend/package.json` — add dev dependencies

---

## Task 1: Install dependencies + test setup

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: Install test dependencies**

```bash
cd frontend
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom @types/testing-library__jest-dom
```

- [ ] **Step 2: Install shadcn/ui dependencies**

```bash
npm install tailwind-merge class-variance-authority sonner
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
// frontend/vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 4: Create vitest.setup.ts**

```typescript
// frontend/vitest.setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Add test script to package.json**

In `frontend/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Run tests to confirm setup works**

```bash
npx vitest run
```

Expected: "No test files found" (not an error — setup is working)

- [ ] **Step 7: Commit**

```bash
git add frontend/vitest.config.ts frontend/vitest.setup.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: add Vitest + RTL test setup"
```

---

## Task 2: Create lib/utils.ts + initialise shadcn/ui

**Files:**
- Create: `frontend/lib/utils.ts`
- Create: `frontend/components.json` (generated by shadcn)

- [ ] **Step 1: Create lib/utils.ts**

```typescript
// frontend/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Initialise shadcn/ui**

```bash
cd frontend
npx shadcn@latest init
```

When prompted, select:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

This generates `components.json` and modifies `globals.css`. We will overwrite `globals.css` in Task 3.

- [ ] **Step 3: Verify components.json exists**

```bash
cat frontend/components.json
```

Expected: JSON file with `"style": "default"`, `"tailwind"` config, and `"aliases"` pointing to `@/components`.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/utils.ts frontend/components.json frontend/globals.css
git commit -m "feat: add cn() utility + initialise shadcn/ui"
```

---

## Task 3: Design tokens + DM Sans font + globals.css

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Replace globals.css with design tokens**

```css
/* frontend/app/globals.css */
@import "tailwindcss";

@theme {
  /* Backgrounds */
  --color-base: #0f172a;
  --color-surface: #0d1117;
  --color-sidebar: #0d0f1f;
  --color-elevated: #1e293b;

  /* Borders */
  --color-border: #1e293b;
  --color-border-active: rgba(99, 102, 241, 0.3);

  /* Brand accents */
  --color-primary: #6366f1;
  --color-secondary: #ec4899;
  --color-primary-muted: rgba(99, 102, 241, 0.13);
  --color-secondary-muted: rgba(236, 72, 153, 0.13);

  /* Text */
  --color-text-primary: #f8fafc;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-text-active: #a5b4fc;

  /* Semantic */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #38bdf8;

  /* Typography */
  --font-sans: var(--font-dm-sans), 'DM Sans', system-ui, sans-serif;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}

/* Base */
* {
  box-sizing: border-box;
}

body {
  background-color: #0f172a;
  color: #f8fafc;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Day mode overrides */
[data-theme="day"] {
  --color-base: #f8fafc;
  --color-surface: #ffffff;
  --color-sidebar: #f1f5f9;
  --color-elevated: #e2e8f0;
  --color-border: #e2e8f0;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #94a3b8;
}

[data-theme="day"] body {
  background-color: #f8fafc;
  color: #0f172a;
}

/* Gradient utility */
.gradient-brand {
  background: linear-gradient(135deg, #6366f1, #ec4899);
}

.gradient-brand-text {
  background: linear-gradient(135deg, #6366f1, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

- [ ] **Step 2: Update layout.tsx to load DM Sans and wire ThemeProvider**

```typescript
// frontend/app/layout.tsx
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "COP Platform",
  description: "Content & Outreach Platform by BuildLab33",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable}`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify fonts load in dev**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000 — body text should render in DM Sans (check Chrome DevTools → computed styles → font-family).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css frontend/app/layout.tsx
git commit -m "feat: add design tokens, DM Sans font, day/night CSS vars"
```

---

## Task 4: Button component

**Files:**
- Create: `frontend/components/ui/button.tsx`
- Create: `frontend/__tests__/ui/button.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/__tests__/ui/button.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies gradient variant class", () => {
    render(<Button variant="gradient">Generate</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("gradient-brand");
  });

  it("applies ghost variant class", () => {
    render(<Button variant="ghost">Cancel</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border");
  });

  it("applies danger variant class", () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-error");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd frontend && npx vitest run __tests__/ui/button.test.tsx
```

Expected: FAIL — "Cannot find module '@/components/ui/button'"

- [ ] **Step 3: Install Button via shadcn, then customise**

```bash
cd frontend && npx shadcn@latest add button
```

Then replace the generated file:

```typescript
// frontend/components/ui/button.tsx
"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        gradient: "gradient-brand text-white hover:opacity-90",
        ghost: "border border-border bg-surface text-text-secondary hover:bg-elevated hover:text-text-primary",
        danger: "bg-error text-white hover:opacity-90",
        icon: "border border-border bg-surface text-text-secondary hover:bg-elevated",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "gradient",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd frontend && npx vitest run __tests__/ui/button.test.tsx
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/button.tsx frontend/__tests__/ui/button.test.tsx
git commit -m "feat: add Button component with gradient/ghost/danger/icon variants"
```

---

## Task 5: Input + Label + Textarea components

**Files:**
- Create: `frontend/components/ui/input.tsx`
- Create: `frontend/components/ui/label.tsx`
- Create: `frontend/components/ui/textarea.tsx`
- Create: `frontend/__tests__/ui/input.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/__tests__/ui/input.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders with placeholder", () => {
    render(<Input placeholder="Enter value" />);
    expect(screen.getByPlaceholderText("Enter value")).toBeInTheDocument();
  });

  it("accepts user input", async () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("shows error styling when error prop is true", () => {
    render(<Input error />);
    expect(screen.getByRole("textbox").className).toContain("border-error");
  });

  it("is disabled when disabled prop passed", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd frontend && npx vitest run __tests__/ui/input.test.tsx
```

Expected: FAIL — "Cannot find module '@/components/ui/input'"

- [ ] **Step 3: Install via shadcn then customise**

```bash
cd frontend && npx shadcn@latest add input label
```

Replace generated files:

```typescript
// frontend/components/ui/input.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary",
          "placeholder:text-text-muted",
          "transition-colors duration-150",
          "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-error focus:border-error focus:ring-error/20" : "border-border",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

```typescript
// frontend/components/ui/label.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "block text-xs font-medium uppercase tracking-wide text-text-secondary mb-1.5",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
```

```typescript
// frontend/components/ui/textarea.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary",
          "placeholder:text-text-muted resize-none",
          "transition-colors duration-150",
          "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-error" : "border-border",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd frontend && npx vitest run __tests__/ui/input.test.tsx
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/input.tsx frontend/components/ui/label.tsx frontend/components/ui/textarea.tsx frontend/__tests__/ui/input.test.tsx
git commit -m "feat: add Input, Label, Textarea components"
```

---

## Task 6: Select component

**Files:**
- Create: `frontend/components/ui/select.tsx`

- [ ] **Step 1: Install via shadcn**

```bash
cd frontend && npx shadcn@latest add select
```

- [ ] **Step 2: Replace with custom styled version**

```typescript
// frontend/components/ui/select.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary",
          "transition-colors duration-150 cursor-pointer",
          "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-error" : "border-border",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export { Select };
```

- [ ] **Step 3: Verify it renders in browser**

Add temporarily to `frontend/app/dashboard/generate/page.tsx` to visually confirm, then revert.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/select.tsx
git commit -m "feat: add Select component"
```

---

## Task 7: Card component

**Files:**
- Create: `frontend/components/ui/card.tsx`
- Create: `frontend/__tests__/ui/card.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/__tests__/ui/card.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card } from "@/components/ui/card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies clickable styles and calls onClick", async () => {
    const onClick = vi.fn();
    render(<Card clickable onClick={onClick}>Click me</Card>);
    const card = screen.getByText("Click me").closest("div");
    await userEvent.click(card!);
    expect(onClick).toHaveBeenCalledOnce();
    expect(card!.className).toContain("cursor-pointer");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd frontend && npx vitest run __tests__/ui/card.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create Card component**

```typescript
// frontend/components/ui/card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  clickable?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, clickable, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-border bg-surface p-5",
        clickable && "cursor-pointer transition-colors duration-150 hover:border-elevated",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center justify-between mb-4", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-sm font-bold text-text-primary", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-text-secondary", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd frontend && npx vitest run __tests__/ui/card.test.tsx
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/card.tsx frontend/__tests__/ui/card.test.tsx
git commit -m "feat: add Card component with clickable variant"
```

---

## Task 8: Badge + Avatar components

**Files:**
- Create: `frontend/components/ui/badge.tsx`
- Create: `frontend/components/ui/avatar.tsx`
- Create: `frontend/__tests__/ui/badge.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/__tests__/ui/badge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("applies default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default").className).toContain("bg-elevated");
  });

  it("applies brand variant", () => {
    render(<Badge variant="brand">Brand</Badge>);
    expect(screen.getByText("Brand").className).toContain("gradient-brand");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd frontend && npx vitest run __tests__/ui/badge.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Install via shadcn then customise**

```bash
cd frontend && npx shadcn@latest add badge avatar
```

Replace with:

```typescript
// frontend/components/ui/badge.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-elevated text-text-secondary",
        brand: "gradient-brand text-white",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        error: "bg-error/15 text-error",
        info: "bg-info/15 text-info",
        outline: "border border-border text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
```

```typescript
// frontend/components/ui/avatar.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback: string;
  size?: "sm" | "md" | "lg";
}

function Avatar({ src, alt, fallback, size = "md", className, ...props }: AvatarProps) {
  const sizes = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-11 w-11 text-base" };
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center overflow-hidden flex-shrink-0",
        sizes[size],
        className
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt ?? fallback} className="h-full w-full object-cover" />
      ) : (
        <div className="gradient-brand h-full w-full flex items-center justify-center text-white font-bold">
          {fallback.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

export { Avatar };
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd frontend && npx vitest run __tests__/ui/badge.test.tsx
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/badge.tsx frontend/components/ui/avatar.tsx frontend/__tests__/ui/badge.test.tsx
git commit -m "feat: add Badge and Avatar components"
```

---

## Task 9: Modal/Dialog component

**Files:**
- Create: `frontend/components/ui/dialog.tsx`

- [ ] **Step 1: Install via shadcn**

```bash
cd frontend && npx shadcn@latest add dialog
```

- [ ] **Step 2: Restyle the generated dialog to match dark theme**

Open `frontend/components/ui/dialog.tsx` and update the overlay and content classes:

Find the `DialogOverlay` className and update to:
```
"fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
```

Find the `DialogContent` className and update to:
```
"fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2"
```

Find `DialogTitle` and update className to:
```
"text-base font-bold text-text-primary"
```

Find `DialogDescription` and update className to:
```
"text-sm text-text-muted mt-1"
```

- [ ] **Step 3: Verify visually in browser**

Start dev server and navigate to any dashboard page. Import and render Dialog temporarily to confirm dark styling renders correctly.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/dialog.tsx
git commit -m "feat: add Dialog/Modal component with dark theme"
```

---

## Task 10: Toast notifications

**Files:**
- Create: `frontend/components/ui/toast.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create toast wrapper using Sonner**

```typescript
// frontend/components/ui/toast.tsx
"use client";
import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#0d1117",
          border: "1px solid #1e293b",
          color: "#f8fafc",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        },
        classNames: {
          success: "!border-success/30",
          error: "!border-error/30",
          warning: "!border-warning/30",
          info: "!border-info/30",
        },
      }}
    />
  );
}

export { toast } from "sonner";
```

- [ ] **Step 2: Add ToastProvider to layout.tsx**

```typescript
// frontend/app/layout.tsx
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "COP Platform",
  description: "Content & Outreach Platform by BuildLab33",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable}`}>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Test toast in browser**

In any client component temporarily add:
```typescript
import { toast } from "@/components/ui/toast";
toast.success("Component system working!");
```

Confirm toast appears bottom-right with dark styling. Remove the test toast.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/toast.tsx frontend/app/layout.tsx
git commit -m "feat: add Toast notifications via Sonner"
```

---

## Task 11: Dropdown + Tooltip + Skeleton

**Files:**
- Create: `frontend/components/ui/dropdown-menu.tsx`
- Create: `frontend/components/ui/tooltip.tsx`
- Create: `frontend/components/ui/skeleton.tsx`

- [ ] **Step 1: Install via shadcn**

```bash
cd frontend && npx shadcn@latest add dropdown-menu tooltip skeleton
```

- [ ] **Step 2: Restyle dropdown-menu.tsx**

In `frontend/components/ui/dropdown-menu.tsx`, update `DropdownMenuContent` className to:
```
"z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-2"
```

Update `DropdownMenuItem` className to:
```
"relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary outline-none transition-colors hover:bg-elevated hover:text-text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
```

- [ ] **Step 3: Restyle tooltip.tsx**

In `frontend/components/ui/tooltip.tsx`, update `TooltipContent` className to:
```
"z-50 overflow-hidden rounded-md border border-border bg-elevated px-3 py-1.5 text-xs text-text-primary shadow-md animate-in fade-in-0 zoom-in-95"
```

- [ ] **Step 4: Replace skeleton.tsx**

```typescript
// frontend/components/ui/skeleton.tsx
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-elevated",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/dropdown-menu.tsx frontend/components/ui/tooltip.tsx frontend/components/ui/skeleton.tsx
git commit -m "feat: add Dropdown, Tooltip, Skeleton components"
```

---

## Task 12: Sidebar component (responsive)

**Files:**
- Create: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar**

```typescript
// frontend/components/layout/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Sparkles, FileText, Calendar,
  Newspaper, Users, Send, UserCheck, Briefcase, Settings, LogOut, Menu, X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/generate", label: "Generate", icon: Sparkles },
  { href: "/dashboard/posts", label: "Posts", icon: FileText },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/news", label: "News Feed", icon: Newspaper },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/outreach", label: "Outreach", icon: Send },
  { href: "/dashboard/clients", label: "Clients", icon: UserCheck },
  { href: "/dashboard/brands", label: "Brands", icon: Briefcase },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-text-primary leading-none">COP Platform</div>
            <div className="text-xs text-text-muted mt-0.5">BuildLab33</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150",
              isActive(href)
                ? "bg-primary-muted border border-primary/20 text-text-active font-semibold"
                : "text-text-muted hover:bg-elevated hover:text-text-primary"
            )}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 mb-2">
          <Avatar fallback={user?.name ?? "U"} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-text-primary truncate">
              {user?.name ?? "User"}
            </div>
            <div className="text-xs text-text-muted">{user?.role ?? "user"}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-text-muted hover:bg-elevated hover:text-error transition-colors"
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] bg-sidebar border-r border-border flex-shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface border border-border text-text-secondary"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-[220px] bg-sidebar border-r border-border transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Verify sidebar renders without errors**

```bash
cd frontend && npm run build
```

Expected: build completes with no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "feat: add responsive Sidebar component (desktop fixed, mobile drawer)"
```

---

## Task 13: PageHeader + LoadingScreen + EmptyState

**Files:**
- Create: `frontend/components/layout/PageHeader.tsx`
- Create: `frontend/components/layout/LoadingScreen.tsx`
- Create: `frontend/components/layout/EmptyState.tsx`

- [ ] **Step 1: Create PageHeader**

```typescript
// frontend/components/layout/PageHeader.tsx
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div>
        <h1 className="text-xl font-bold text-text-primary">{title}</h1>
        {subtitle && (
          <p className="text-xs text-text-muted mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create LoadingScreen**

```typescript
// frontend/components/layout/LoadingScreen.tsx
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl gradient-brand mx-auto mb-4 animate-pulse" />
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create EmptyState**

```typescript
// frontend/components/layout/EmptyState.tsx
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && (
        <div className="text-text-muted mb-4 text-4xl">{icon}</div>
      )}
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted mb-6 max-w-sm">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/PageHeader.tsx frontend/components/layout/LoadingScreen.tsx frontend/components/layout/EmptyState.tsx
git commit -m "feat: add PageHeader, LoadingScreen, EmptyState layout components"
```

---

## Task 14: OnboardingTooltip

**Files:**
- Create: `frontend/components/layout/OnboardingTooltip.tsx`

- [ ] **Step 1: Create OnboardingTooltip**

The tooltip shows once per page key. It stores dismissed state in localStorage.

```typescript
// frontend/components/layout/OnboardingTooltip.tsx
"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingTooltipProps {
  pageKey: string;
  title: string;
  description: string;
  className?: string;
}

export function OnboardingTooltip({ pageKey, title, description, className }: OnboardingTooltipProps) {
  const storageKey = `onboarding_dismissed_${pageKey}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-primary/30 bg-primary-muted p-4 mb-6",
        className
      )}
    >
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Dismiss tip"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-1.5 h-1.5 rounded-full gradient-brand mt-1.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-text-active mb-1">{title}</p>
          <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/layout/OnboardingTooltip.tsx
git commit -m "feat: add OnboardingTooltip (first-visit guided tips, localStorage dismissed)"
```

---

## Task 15: Domain components

**Files:**
- Create: `frontend/components/domain/StatusBadge.tsx`
- Create: `frontend/components/domain/BrandBadge.tsx`
- Create: `frontend/components/domain/PlatformPill.tsx`
- Create: `frontend/components/domain/CharacterCounter.tsx`
- Create: `frontend/__tests__/domain/StatusBadge.test.tsx`
- Create: `frontend/__tests__/domain/BrandBadge.test.tsx`
- Create: `frontend/__tests__/domain/PlatformPill.test.tsx`
- Create: `frontend/__tests__/domain/CharacterCounter.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/__tests__/domain/StatusBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/domain/StatusBadge";

describe("StatusBadge", () => {
  it("renders draft status", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
  it("renders approved status with success colour", () => {
    render(<StatusBadge status="approved" />);
    const el = screen.getByText("Approved");
    expect(el.className).toContain("text-success");
  });
  it("renders pending status with warning colour", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("Pending").className).toContain("text-warning");
  });
});
```

```typescript
// frontend/__tests__/domain/BrandBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandBadge } from "@/components/domain/BrandBadge";

describe("BrandBadge", () => {
  it("renders brand name", () => {
    render(<BrandBadge brandId="yeon-studios" brandName="Yeon Studios" />);
    expect(screen.getByText("Yeon Studios")).toBeInTheDocument();
  });
  it("applies gradient class", () => {
    render(<BrandBadge brandId="yeon-studios" brandName="Yeon Studios" />);
    expect(screen.getByText("Yeon Studios").parentElement!.className).toContain("gradient-brand");
  });
});
```

```typescript
// frontend/__tests__/domain/PlatformPill.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlatformPill } from "@/components/domain/PlatformPill";

describe("PlatformPill", () => {
  it("renders platform label", () => {
    render(<PlatformPill platform="linkedin" active={false} onToggle={vi.fn()} />);
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
  });
  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<PlatformPill platform="linkedin" active={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByText("LinkedIn"));
    expect(onToggle).toHaveBeenCalledWith("linkedin");
  });
});
```

```typescript
// frontend/__tests__/domain/CharacterCounter.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterCounter } from "@/components/domain/CharacterCounter";

describe("CharacterCounter", () => {
  it("shows current and max count", () => {
    render(<CharacterCounter current={50} max={280} />);
    expect(screen.getByText("50 / 280")).toBeInTheDocument();
  });
  it("shows warning colour when near limit", () => {
    render(<CharacterCounter current={260} max={280} />);
    const el = screen.getByText("260 / 280");
    expect(el.className).toContain("text-warning");
  });
  it("shows error colour when over limit", () => {
    render(<CharacterCounter current={290} max={280} />);
    const el = screen.getByText("290 / 280");
    expect(el.className).toContain("text-error");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd frontend && npx vitest run __tests__/domain/
```

Expected: FAIL — modules not found

- [ ] **Step 3: Create domain components**

```typescript
// frontend/components/domain/StatusBadge.tsx
import { cn } from "@/lib/utils";

type Status = "draft" | "pending" | "approved" | "scheduled" | "published" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  draft: { label: "Draft", className: "text-text-muted" },
  pending: { label: "Pending", className: "text-warning" },
  approved: { label: "Approved", className: "text-success" },
  scheduled: { label: "Scheduled", className: "text-primary" },
  published: { label: "Published", className: "text-success" },
  rejected: { label: "Rejected", className: "text-error" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn("text-xs font-semibold flex items-center gap-1", config.className, className)}>
      <span>●</span>
      {config.label}
    </span>
  );
}
```

```typescript
// frontend/components/domain/BrandBadge.tsx
import { cn } from "@/lib/utils";

interface BrandBadgeProps {
  brandId: string;
  brandName: string;
  className?: string;
}

export function BrandBadge({ brandName, className }: BrandBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white gradient-brand",
        className
      )}
    >
      {brandName}
    </span>
  );
}
```

```typescript
// frontend/components/domain/PlatformPill.tsx
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X (Twitter)",
  youtube: "YouTube",
};

interface PlatformPillProps {
  platform: string;
  active: boolean;
  onToggle: (platform: string) => void;
  className?: string;
}

export function PlatformPill({ platform, active, onToggle, className }: PlatformPillProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(platform)}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-150",
        active
          ? "bg-primary-muted border-primary/30 text-text-active"
          : "bg-surface border-border text-text-muted hover:border-elevated hover:text-text-secondary",
        className
      )}
    >
      {PLATFORM_LABELS[platform] ?? platform}
    </button>
  );
}
```

```typescript
// frontend/components/domain/CharacterCounter.tsx
import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function CharacterCounter({ current, max, className }: CharacterCounterProps) {
  const isOver = current > max;
  const isWarning = !isOver && current > max * 0.92;

  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        isOver ? "text-error" : isWarning ? "text-warning" : "text-text-muted",
        className
      )}
    >
      {current} / {max}
    </span>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd frontend && npx vitest run __tests__/domain/
```

Expected: PASS — 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add frontend/components/domain/ frontend/__tests__/domain/
git commit -m "feat: add StatusBadge, BrandBadge, PlatformPill, CharacterCounter domain components"
```

---

## Task 16: ThemeProvider (day/night mode)

**Files:**
- Create: `frontend/lib/theme.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create ThemeProvider**

```typescript
// frontend/lib/theme.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "night" | "day";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "night",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "day" || stored === "night") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "night" ? "day" : "night";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Add ThemeProvider to layout.tsx**

```typescript
// frontend/app/layout.tsx
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/lib/theme";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "COP Platform",
  description: "Content & Outreach Platform by BuildLab33",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable}`}>
        <ThemeProvider>
          {children}
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/theme.tsx frontend/app/layout.tsx
git commit -m "feat: add ThemeProvider with day/night mode toggle and localStorage persistence"
```

---

## Task 17: Migrate existing pages

**Files:**
- Modify: `frontend/app/dashboard/layout.tsx`
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/dashboard/generate/page.tsx`
- Modify: `frontend/app/dashboard/posts/page.tsx`
- Modify: `frontend/app/dashboard/calendar/page.tsx`
- Modify: `frontend/app/dashboard/leads/page.tsx`
- Modify: `frontend/app/dashboard/outreach/page.tsx`

- [ ] **Step 1: Update dashboard layout to use new Sidebar + LoadingScreen**

```typescript
// frontend/app/dashboard/layout.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setAuth, loadFromStorage } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      loadFromStorage();
      const token = localStorage.getItem("access_token");
      if (!token) { router.push("/login"); return; }
      try {
        const res = await getMe();
        setAuth(res.data, token, localStorage.getItem("refresh_token") ?? "");
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, setAuth, loadFromStorage]);

  if (!mounted || loading) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update login page**

```typescript
// frontend/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      const { access_token, refresh_token, user } = res.data;
      setAuth(user, access_token, refresh_token);
      router.push("/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary">COP Platform</h1>
          <p className="text-xs text-text-muted mt-1">Sign in to continue</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && (
                <p className="text-xs text-error">{error}</p>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update placeholder pages (calendar, leads, outreach) to use EmptyState**

```typescript
// frontend/app/dashboard/calendar/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";

export default function CalendarPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="Calendar" subtitle="Schedule and view your posts" />
      <EmptyState
        icon={<Calendar size={40} />}
        title="Coming in Phase 2"
        description="The calendar view with clash detection is being built next."
        action={
          <Button onClick={() => router.push("/dashboard/generate")}>
            ✦ Generate Content Instead
          </Button>
        }
      />
    </div>
  );
}
```

Apply same pattern to `leads/page.tsx` (use `Users` icon, label "Leads") and `outreach/page.tsx` (use `Send` icon, label "Outreach").

- [ ] **Step 4: Update dashboard home page**

Replace all inline styles in `frontend/app/dashboard/page.tsx` with Tailwind classes using the new components:
- Replace `<div className="card">` with `<Card clickable>`
- Replace `<button className="btn-primary">` with `<Button>`
- Replace brand badge spans with `<BrandBadge>`
- Replace inline heading styles with `className="text-2xl font-bold text-text-primary"`

- [ ] **Step 5: Update generate page**

Replace in `frontend/app/dashboard/generate/page.tsx`:
- Form inputs: replace `className="form-input"` with `<Input>` component
- Labels: replace `className="form-label"` with `<Label>` component
- Platform buttons: replace inline styled buttons with `<PlatformPill>`
- Generate button: replace `<button className="btn-primary">` with `<Button>`
- Result card: replace `<div className="card">` with `<Card>`
- Brand/platform labels: replace with `<BrandBadge>` and `<Badge variant="default">`
- Add `<CharacterCounter current={result?.text?.length ?? 0} max={PLATFORM_LIMITS[platform]} />`

Add at top of file:
```typescript
const PLATFORM_LIMITS: Record<string, number> = {
  linkedin: 3000, instagram: 2200, tiktok: 150,
  facebook: 63206, x: 280, youtube: 5000,
};
```

- [ ] **Step 6: Update posts page**

Replace in `frontend/app/dashboard/posts/page.tsx`:
- Post cards: replace `<div className="card">` with `<Card>`
- Status display: replace inline colour spans with `<StatusBadge status={post.status}>`
- Brand display: replace class-based badges with `<BrandBadge brandId={post.brand_id} brandName={...}>`
- Buttons: replace `className="btn-primary"` / `"btn-secondary"` with `<Button>` / `<Button variant="ghost">`

- [ ] **Step 7: Build and verify no errors**

```bash
cd frontend && npm run build
```

Expected: successful build with no TypeScript errors

- [ ] **Step 8: Run full test suite**

```bash
cd frontend && npx vitest run
```

Expected: all tests passing

- [ ] **Step 9: Final commit**

```bash
git add frontend/app/ frontend/components/
git commit -m "feat: migrate all pages to UI component system — remove all inline styles"
```

---

## Self-Review Checklist

After completing all tasks, verify against the spec (Section 3 — Component Inventory):

- [ ] Core UI: Button ✓, Input ✓, Textarea ✓, Select ✓, Card ✓, Modal ✓, Toast ✓, Dropdown ✓, Badge ✓, Avatar ✓, Tooltip ✓, Skeleton ✓
- [ ] Layout: Sidebar ✓, PageHeader ✓, LoadingScreen ✓, EmptyState ✓, OnboardingTooltip ✓
- [ ] Domain: StatusBadge ✓, BrandBadge ✓, PlatformPill ✓, CharacterCounter ✓
- [ ] Design tokens in globals.css ✓
- [ ] DM Sans font loaded ✓
- [ ] Day/Night mode ThemeProvider ✓
- [ ] All existing pages migrated — no inline styles remaining ✓
- [ ] All tests passing ✓
- [ ] Build succeeds ✓
- [ ] Committed to git ✓

---

*Plan written 2026-04-30. Implements Section 1–3 of the Phase 2 spec (design system, layout, components). Next plan: Authentication Upgrades.*
