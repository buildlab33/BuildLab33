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
    expect(screen.getByText("Yeon Studios").className).toContain("gradient-brand");
  });
});
