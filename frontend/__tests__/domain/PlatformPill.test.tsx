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
