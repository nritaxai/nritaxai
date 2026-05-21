import fs from "node:fs";

const files = [
  "infra/k8s/base/api-rollout.yaml",
  "infra/k8s/base/worker-deployment.yaml",
  "infra/k8s/base/priority-worker-deployment.yaml",
  "infra/k8s/base/batch-worker-deployment.yaml",
  "infra/k8s/base/ai-worker-deployment.yaml",
];

const mustContain = [
  "/readyz",
  "/livez",
];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const token of mustContain) {
    if (!content.includes(token)) {
      throw new Error(`${file} is missing required probe path ${token}`);
    }
  }
}

const rollout = fs.readFileSync("infra/k8s/base/api-rollout.yaml", "utf8");
for (const token of ["stableService:", "canaryService:", "setWeight:", "pause:"]) {
  if (!rollout.includes(token)) {
    throw new Error(`api-rollout.yaml is missing canary safety token ${token}`);
  }
}

process.stdout.write("k8s-safety-ok\n");
