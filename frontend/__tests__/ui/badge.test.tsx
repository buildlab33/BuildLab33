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
