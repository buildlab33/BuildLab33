import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

describe("useInactivityLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls onLogout after timeout with no activity", () => {
    const onLogout = vi.fn();
    renderHook(() => useInactivityLogout({ timeoutMs: 1000, onLogout }));
    act(() => { vi.advanceTimersByTime(1001); });
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("resets timer on mousemove and does not call onLogout early", () => {
    const onLogout = vi.fn();
    renderHook(() => useInactivityLogout({ timeoutMs: 1000, onLogout }));
    act(() => {
      vi.advanceTimersByTime(800);
      window.dispatchEvent(new Event("mousemove"));
      vi.advanceTimersByTime(800);
    });
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("calls onLogout after timeout resets and expires", () => {
    const onLogout = vi.fn();
    renderHook(() => useInactivityLogout({ timeoutMs: 1000, onLogout }));
    act(() => {
      vi.advanceTimersByTime(800);
      window.dispatchEvent(new Event("keydown"));
      vi.advanceTimersByTime(1001);
    });
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
