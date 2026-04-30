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
