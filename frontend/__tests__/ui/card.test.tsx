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
