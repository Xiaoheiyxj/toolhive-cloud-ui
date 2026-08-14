import { access, cp, mkdir } from "node:fs/promises";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });

if (await exists("public")) {
  await cp("public", ".next/standalone/public", { recursive: true });
}
