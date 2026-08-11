import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playNotificationSound } from "@/lib/sound";

describe("sound synthesizer engine", () => {
  beforeEach(() => {
    const MockAudioContext = vi.fn(function (this: any) {
      this.state = "running";
      this.currentTime = 0;
      this.createOscillator = vi.fn().mockReturnValue({
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      });
      this.createGain = vi.fn().mockReturnValue({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      });
      this.destination = {};
      this.resume = vi.fn().mockResolvedValue(undefined);
    });

    vi.stubGlobal("window", {
      AudioContext: MockAudioContext,
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
    vi.stubGlobal("window", {
      AudioContext: undefined,
    });
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => playNotificationSound("chime")).not.toThrow();
  });
});
