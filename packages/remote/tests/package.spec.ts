import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("dsh-remote package", () => {
  it("publishes and composes the incoming relay transport", async () => {
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      files: string[];
    };
    const patch = await readFile(join(root, "cordis.patch.yml"), "utf8");
    expect(manifest.exports).toHaveProperty("./relay-channel");
    expect(manifest.files).toContain("lib/relay-channel.js");
    expect(manifest.files).toContain("lib/relay-socket-*.js");
    expect(patch).toContain("name: 'dsh-remote/relay-channel'");
  });
});
