import { spawn } from "node:child_process";

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

await run("npm", ["--prefix", "client", "run", "lint"]);
await run("npm", ["--prefix", "server", "run", "lint"]);
