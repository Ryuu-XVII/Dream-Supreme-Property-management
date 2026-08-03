import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playNotificationSound } from "@/lib/sound";

describe("sound synthesizer engine", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      AudioContext: vi.fn().mockImplementation(() => ({
        state: "running",
        currentTime: 0,
        createOscillator: vi.fn().mockReturnValue({
          type: "sine",
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: vi.fn().mockReturnValue({
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        }),
        destination: {},
        resume: vi.fn().mockResolvedValue(undefined),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays chime sound without throwing", () => {
    expect(() => playNotificationSound("chime")).not.toThrow();
  });

  it("plays success sound without throwing", () => {
    expect(() => playNotificationSound("success")).not.toThrow();
  });

  it("plays alert sound without throwing", () => {
    expect(() => playNotificationSound("alert")).not.toThrow();
  });

  it("handles environment without Web Audio API gracefully without throwing", () => {
    vi.stubGlobal("window", {});
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => playNotificationSound("chime")).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
