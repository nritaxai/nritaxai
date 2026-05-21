import { spawn } from "node:child_process";

const root = process.cwd();

const processes = [
  {
    name: "frontend",
    command: "npm",
    args: ["--prefix", "client", "run", "dev"],
  },
  {
    name: "backend",
    command: "npm",
    args: ["--prefix", "server", "run", "dev"],
  },
];

if (String(process.env.START_WORKER || "").trim().toLowerCase() === "true") {
  processes.push({
    name: "worker",
    command: "npm",
    args: ["--prefix", "server", "run", "worker"],
  });
}

const children = processes.map((processSpec) =>
  spawn(processSpec.command, processSpec.args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
  })
);

const shutdown = () => {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.race(
  children.map(
    (child) =>
      new Promise((resolve, reject) => {
        child.on("exit", (code) => {
          if (code === 0 || code === null) resolve();
          else reject(new Error(`workspace process exited with code ${code}`));
        });
      })
  )
).finally(shutdown);
