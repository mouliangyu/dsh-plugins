import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("session-control package", () => {
  it("publishes the host, invariant, and client entries", async () => {
    const manifest = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    ) as {
      name: string;
      private: boolean;
      exports: Record<string, unknown>;
      files: string[];
    };
    expect(manifest.name).toBe("dsh-session-control");
    expect(manifest.private).toBe(false);
    expect(Object.keys(manifest.exports)).toEqual(
      expect.arrayContaining([".", "./invariant", "./client", "./relay", "./package.json"]),
    );
    expect(manifest.files).toEqual(
      expect.arrayContaining(["lib/types/**/*.d.ts", "TESTING.md"]),
    );
  });

  it("mounts the published package name from its bundle patch", async () => {
    const patch = await readFile(join(root, "cordis.patch.yml"), "utf8");
    expect(patch).toContain('name: "dsh-session-control"');
    expect(patch).toContain("allowGlobalAccess: true");
  });
});
