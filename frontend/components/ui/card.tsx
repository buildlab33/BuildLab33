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
