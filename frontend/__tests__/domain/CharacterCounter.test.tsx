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
