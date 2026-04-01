import { describe, it, expect, vi } from "vitest";
import { PermissionPolicy, DEFAULT_PERMISSION_RULES } from "../permissions";

describe("PermissionPolicy", () => {
  it("allows by default when mode is allow", async () => {
    const policy = new PermissionPolicy("allow");
    const decision = await policy.check("anything");
    expect(decision.allowed).toBe(true);
    expect(decision.mode).toBe("allow");
  });

  it("denies by default when mode is deny", async () => {
    const policy = new PermissionPolicy("deny");
    const decision = await policy.check("anything");
    expect(decision.allowed).toBe(false);
  });

  it("respects tool-specific rules over default", async () => {
    const policy = new PermissionPolicy("allow");
    policy.setRule({ toolName: "dangerous", mode: "deny", reason: "too risky" });
    const safe = await policy.check("safe_tool");
    const dangerous = await policy.check("dangerous");
    expect(safe.allowed).toBe(true);
    expect(dangerous.allowed).toBe(false);
    expect(dangerous.reason).toBe("too risky");
  });

  it("prompts user and respects their decision", async () => {
    const policy = new PermissionPolicy("allow");
    policy.setRule({ toolName: "sms.send", mode: "prompt" });
    const prompter = vi.fn().mockResolvedValue(true);
    policy.setPrompter(prompter);

    const decision = await policy.check("sms.send", { to: "+1234" });
    expect(prompter).toHaveBeenCalledWith("sms.send", { to: "+1234" }, undefined);
    expect(decision.allowed).toBe(true);
    expect(decision.promptedUser).toBe(true);
  });

  it("fails closed when prompter is missing", async () => {
    const policy = new PermissionPolicy("allow");
    policy.setRule({ toolName: "sms.send", mode: "prompt" });
    // No prompter registered
    const decision = await policy.check("sms.send");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("no prompter");
  });

  it("loads default rules without error", () => {
    const policy = new PermissionPolicy("allow");
    policy.setRules(DEFAULT_PERMISSION_RULES);
    expect(policy.listRules().length).toBe(DEFAULT_PERMISSION_RULES.length);
    expect(policy.getMode("cascade.sendSms")).toBe("prompt");
    expect(policy.getMode("recommendation.score")).toBe("allow");
    expect(policy.getMode("data.bulkDelete")).toBe("deny");
  });
});
