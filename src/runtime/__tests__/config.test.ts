import { describe, it, expect } from "vitest";
import { LayeredConfig } from "../config";
import { DEFAULT_CONFIG } from "../types";

describe("LayeredConfig", () => {
  it("returns defaults when no layers added", () => {
    const config = new LayeredConfig();
    const resolved = config.resolve();
    expect(resolved.maxTokens).toBe(DEFAULT_CONFIG.maxTokens);
    expect(resolved.recommendationWeights.scriptureMatch).toBe(30);
  });

  it("global layer overrides defaults", () => {
    const config = new LayeredConfig();
    config.addLayer({ scope: "global", values: { maxTokens: 50000 } });
    expect(config.resolve().maxTokens).toBe(50000);
  });

  it("parish layer overrides global", () => {
    const config = new LayeredConfig();
    config.addLayer({ scope: "global", values: { repetitionPreference: 3 } });
    config.addLayer({
      scope: "parish",
      scopeId: "p1",
      values: { repetitionPreference: 8 },
    });
    expect(config.resolve().repetitionPreference).toBe(8);
  });

  it("user layer overrides parish", () => {
    const config = new LayeredConfig();
    config.addLayer({
      scope: "parish",
      scopeId: "p1",
      values: { repetitionPreference: 8 },
    });
    config.addLayer({
      scope: "user",
      scopeId: "u1",
      values: { repetitionPreference: 2 },
    });
    expect(config.resolve().repetitionPreference).toBe(2);
  });

  it("deep-merges recommendationWeights", () => {
    const config = new LayeredConfig();
    config.addLayer({
      scope: "parish",
      scopeId: "p1",
      values: { recommendationWeights: { scriptureMatch: 50 } },
    });
    const resolved = config.resolve();
    expect(resolved.recommendationWeights.scriptureMatch).toBe(50);
    // Other weights should still have defaults
    expect(resolved.recommendationWeights.topicMatch).toBe(20);
  });

  it("forContext factory creates correct layers", () => {
    const config = LayeredConfig.forContext(
      { maxTokens: 100000 },
      "parish-123",
      { repetitionPreference: 7 },
      "user-456",
      { repetitionPreference: 3 }
    );
    const resolved = config.resolve();
    expect(resolved.maxTokens).toBe(100000);
    expect(resolved.repetitionPreference).toBe(3); // user wins
    expect(resolved.parishId).toBe("parish-123");
    expect(resolved.userId).toBe("user-456");
  });

  it("get() returns most specific value", () => {
    const config = LayeredConfig.forContext(
      { maxTokens: 100000 },
      "p1",
      { maxTokens: 50000 }
    );
    expect(config.get<number>("maxTokens")).toBe(50000);
  });
});
