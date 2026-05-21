import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const run = (command, args, cwd = process.cwd()) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });

const hasPackageScript = async (packageDir, scriptName) => {
  const packageJsonPath = path.join(packageDir, "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw);
  return Boolean(parsed?.scripts && typeof parsed.scripts[scriptName] === "string" && parsed.scripts[scriptName].trim());
};

const runIfDefined = async (packageDir, scriptName) => {
  if (!(await hasPackageScript(packageDir, scriptName))) {
    console.log(`[workspace:${scriptName}] Skipping ${packageDir} because no "${scriptName}" script is defined.`);
    return;
  }

  await run("npm", ["--prefix", packageDir, "run", scriptName]);
};

await runIfDefined("client", "typecheck");
await runIfDefined("server", "typecheck");
