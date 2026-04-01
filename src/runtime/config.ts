/**
 * Layered Runtime Configuration
 * Ref: DESIGN-SPEC-v2.md Section 16.1 Pattern 6
 *
 * Resolves config by merging layers: global → parish → user.
 * Later layers override earlier ones. This powers multi-parish tenancy
 * where each parish has its own recommendation weights, repetition
 * preferences, ensemble names, and permission defaults.
 */

import type {
  ConfigLayer,
  ConfigScope,
  RuntimeConfig,
  ToolServerDefinition,
} from "./types";
import { DEFAULT_CONFIG } from "./types";

export class LayeredConfig {
  private layers: ConfigLayer[] = [];

  constructor(initialLayers?: ConfigLayer[]) {
    if (initialLayers) {
      this.layers = [...initialLayers];
    }
  }

  /**
   * Add a config layer. Layers are applied in order: global first, user last.
   */
  addLayer(layer: ConfigLayer): void {
    // Insert in scope order: global < parish < user
    const order: ConfigScope[] = ["global", "parish", "user"];
    const insertIdx = order.indexOf(layer.scope);
    const existingIdx = this.layers.findIndex(
      (l) => l.scope === layer.scope && l.scopeId === layer.scopeId
    );

    if (existingIdx >= 0) {
      // Replace existing layer at same scope+id
      this.layers[existingIdx] = layer;
    } else {
      // Insert at correct position
      let pos = this.layers.length;
      for (let i = 0; i < this.layers.length; i++) {
        if (order.indexOf(this.layers[i].scope) > insertIdx) {
          pos = i;
          break;
        }
      }
      this.layers.splice(pos, 0, layer);
    }
  }

  /**
   * Remove a config layer by scope and optional ID.
   */
  removeLayer(scope: ConfigScope, scopeId?: string): void {
    this.layers = this.layers.filter(
      (l) => !(l.scope === scope && l.scopeId === scopeId)
    );
  }

  /**
   * Resolve a single config value by walking layers from global → user.
   * Returns the most specific (last) non-undefined value.
   */
  get<T>(key: string): T | undefined {
    let result: T | undefined;
    for (const layer of this.layers) {
      if (key in layer.values && layer.values[key] !== undefined) {
        result = layer.values[key] as T;
      }
    }
    return result;
  }

  /**
   * Resolve the full RuntimeConfig by deep-merging all layers over defaults.
   */
  resolve(): RuntimeConfig {
    const merged = structuredClone(DEFAULT_CONFIG);

    for (const layer of this.layers) {
      for (const [key, value] of Object.entries(layer.values)) {
        if (value === undefined) continue;

        if (key === "recommendationWeights" && typeof value === "object") {
          Object.assign(merged.recommendationWeights, value);
        } else if (key === "toolServers" && Array.isArray(value)) {
          // Tool servers merge by name (later layers override)
          const serverMap = new Map<string, ToolServerDefinition>();
          for (const s of merged.toolServers) serverMap.set(s.name, s);
          for (const s of value as ToolServerDefinition[]) serverMap.set(s.name, s);
          merged.toolServers = Array.from(serverMap.values());
        } else {
          // Allow setting fields like parishId and userId that aren't in defaults
          (merged as unknown as Record<string, unknown>)[key] = value;
        }
      }
    }

    return merged;
  }

  /**
   * Create a config snapshot for a specific parish + user combination.
   * Convenience for request-scoped config resolution.
   */
  static forContext(
    globalValues: Record<string, unknown>,
    parishId?: string,
    parishValues?: Record<string, unknown>,
    userId?: string,
    userValues?: Record<string, unknown>
  ): LayeredConfig {
    const config = new LayeredConfig();

    config.addLayer({ scope: "global", values: globalValues });

    if (parishId && parishValues) {
      config.addLayer({
        scope: "parish",
        scopeId: parishId,
        values: { ...parishValues, parishId },
      });
    }

    if (userId && userValues) {
      config.addLayer({
        scope: "user",
        scopeId: userId,
        values: { ...userValues, userId },
      });
    }

    return config;
  }
}
