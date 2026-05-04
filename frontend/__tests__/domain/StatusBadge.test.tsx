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
