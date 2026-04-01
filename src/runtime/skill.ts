/**
 * Skill Loader — Dynamic instruction file loading
 * Ref: DESIGN-SPEC-v2.md Section 16.1 Pattern 5
 *
 * Skills are markdown instruction files that define step-by-step
 * workflows (cantor briefs, wedding planner, funeral guide, etc.).
 * Loading them dynamically means the runtime can adapt its behavior
 * based on context without hardcoded logic.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import type { SkillDefinition } from "./types";

const SKILLS_DIR = join(process.cwd(), "src", "skills");

// In-memory cache: skill name → loaded content
const skillCache = new Map<string, SkillDefinition>();

/**
 * Registry of known skills. New skills are registered here.
 * The instructionPath is relative to src/skills/.
 */
const SKILL_REGISTRY: Omit<SkillDefinition, "instructions">[] = [
  {
    name: "cantor-brief",
    description:
      "Saturday night practice flow: view assignments, interactive notation, audio playback, part isolation",
    instructionPath: "cantor-brief.md",
  },
  {
    name: "wedding-planner",
    description:
      "Step-by-step wedding music selection using Together for Life codes with constrained customization",
    instructionPath: "wedding-planner.md",
  },
  {
    name: "funeral-guide",
    description:
      "Pastoral bereavement music selection following Order of Christian Funerals with secular song mediation",
    instructionPath: "funeral-guide.md",
  },
  {
    name: "sunday-prep",
    description:
      "Director weekly preparation checklist: verify assignments, distribute materials, confirm musicians",
    instructionPath: "sunday-prep.md",
  },
  {
    name: "season-briefing",
    description:
      "Seasonal planning overview with recommendation context and upcoming liturgical highlights",
    instructionPath: "season-briefing.md",
  },
];

export class SkillLoader {
  private registry: Map<string, Omit<SkillDefinition, "instructions">>;
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? SKILLS_DIR;
    this.registry = new Map();
    for (const skill of SKILL_REGISTRY) {
      this.registry.set(skill.name, skill);
    }
  }

  /**
   * Register a custom skill at runtime.
   */
  register(skill: Omit<SkillDefinition, "instructions">): void {
    this.registry.set(skill.name, skill);
  }

  /**
   * Load a skill by name. Returns the skill definition with its
   * instruction content loaded from disk. Caches after first load.
   */
  async load(name: string): Promise<SkillDefinition> {
    // Check cache
    const cached = skillCache.get(name);
    if (cached) return cached;

    // Look up in registry
    const entry = this.registry.get(name);
    if (!entry) {
      throw new Error(
        `Skill "${name}" not found. Available: ${this.listNames().join(", ")}`
      );
    }

    // Load instruction file
    const filePath = join(this.basePath, entry.instructionPath);
    let instructions: string;
    try {
      instructions = await readFile(filePath, "utf-8");
    } catch {
      // Skill file doesn't exist yet. Return a placeholder.
      instructions = `# ${entry.name}\n\n${entry.description}\n\n(Skill instructions not yet written.)`;
    }

    const skill: SkillDefinition = { ...entry, instructions };
    skillCache.set(name, skill);
    return skill;
  }

  /**
   * List all registered skill names.
   */
  listNames(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * List all registered skills with descriptions.
   */
  list(): Omit<SkillDefinition, "instructions">[] {
    return Array.from(this.registry.values());
  }

  /**
   * Clear the cache (useful for hot-reloading during development).
   */
  clearCache(): void {
    skillCache.clear();
  }
}
