import { describe, it, expect } from "vitest";
import { ConversationRuntime } from "../conversation";
import { LayeredConfig } from "../config";
import { PermissionPolicy } from "../permissions";
import type { ToolDefinition } from "../types";

function makeRuntime(tools?: ToolDefinition[]) {
  const config = LayeredConfig.forContext({ maxTokens: 10000 });
  const permissions = new PermissionPolicy("allow");
  const toolMap = new Map<string, ToolDefinition>();
  for (const t of tools ?? []) toolMap.set(t.name, t);
  return new ConversationRuntime(config, permissions, toolMap);
}

const echoTool: ToolDefinition = {
  name: "echo",
  description: "Returns whatever you pass it",
  handler: async (args) => args,
};

const failTool: ToolDefinition = {
  name: "fail",
  description: "Always throws",
  handler: async () => {
    throw new Error("intentional failure");
  },
};

describe("ConversationRuntime", () => {
  it("creates a conversation with a unique ID", () => {
    const rt = makeRuntime();
    expect(rt.getConversationId()).toBeTruthy();
    expect(rt.getState().turns).toHaveLength(0);
  });

  it("tracks user and assistant turns", () => {
    const rt = makeRuntime();
    rt.addUserTurn("hello");
    rt.addAssistantTurn("hi back");
    expect(rt.getState().turns).toHaveLength(2);
    expect(rt.getState().turns[0].role).toBe("user");
    expect(rt.getState().turns[1].role).toBe("assistant");
  });

  it("executes a tool and records the result", async () => {
    const rt = makeRuntime([echoTool]);
    const result = await rt.executeTool({
      name: "echo",
      args: { message: "test" },
    });
    expect(result.error).toBeUndefined();
    expect(result.output).toEqual({ message: "test" });
    expect(rt.getState().turns).toHaveLength(1);
    expect(rt.getState().turns[0].role).toBe("tool");
    expect(rt.getUsageStats().toolCalls).toBe(1);
  });

  it("handles tool errors gracefully", async () => {
    const rt = makeRuntime([failTool]);
    const result = await rt.executeTool({ name: "fail", args: {} });
    expect(result.error).toBe("intentional failure");
    expect(result.output).toBeUndefined();
  });

  it("rejects unknown tools", async () => {
    const rt = makeRuntime();
    const result = await rt.executeTool({ name: "nonexistent", args: {} });
    expect(result.error).toContain("not registered");
  });

  it("executes a tool sequence and stops on error when requested", async () => {
    const rt = makeRuntime([echoTool, failTool]);
    const results = await rt.executeToolSequence(
      [
        { name: "echo", args: { a: 1 } },
        { name: "fail", args: {} },
        { name: "echo", args: { a: 2 } },
      ],
      true
    );
    expect(results).toHaveLength(2); // stopped after fail
    expect(results[0].error).toBeUndefined();
    expect(results[1].error).toBe("intentional failure");
  });

  it("tracks token estimates", () => {
    const rt = makeRuntime();
    rt.addUserTurn("a".repeat(400)); // ~100 tokens
    expect(rt.getTotalTokens()).toBeGreaterThan(0);
  });
});
