import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const distDir = path.join(rootDir, "dist");
const statsPath = path.join(distDir, "bundle-stats.json");
const outputPath = path.join(rootDir, "..", "docs", "frontend-bundle-report-2026-05.md");

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

if (!fs.existsSync(statsPath)) {
  console.error(`Bundle stats not found at ${statsPath}`);
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, "utf8"));
const topAssets = [...(stats.assets || [])]
  .sort((left, right) => Number(right.gzipSize || right.size || 0) - Number(left.gzipSize || left.size || 0))
  .slice(0, 12);

const totalJsBytes = (stats.assets || [])
  .filter((asset) => String(asset.fileName || "").endsWith(".js"))
  .reduce((sum, asset) => sum + Number(asset.size || 0), 0);

const totalCssBytes = (stats.assets || [])
  .filter((asset) => String(asset.fileName || "").endsWith(".css"))
  .reduce((sum, asset) => sum + Number(asset.size || 0), 0);

const markdown = `# Frontend Bundle Report

Generated: ${new Date().toISOString()}

## Build Summary

- Total JavaScript: ${formatSize(totalJsBytes)}
- Total CSS: ${formatSize(totalCssBytes)}
- Total emitted assets: ${Array.isArray(stats.assets) ? stats.assets.length : 0}

## Largest Assets

| Asset | Raw Size | Gzip Size |
| --- | ---: | ---: |
${topAssets
  .map(
    (asset) =>
      `| ${asset.fileName} | ${formatSize(Number(asset.size || 0))} | ${formatSize(Number(asset.gzipSize || asset.size || 0))} |`
  )
  .join("\n")}

## Notes

- This report is generated from Vite build output and can be used during rollout validation.
- Use the chunk names to confirm that chat, dashboard, PDF export, MUI, and vendor code stay isolated from the initial route bundle.
`;

fs.writeFileSync(outputPath, markdown, "utf8");
console.log(`Wrote bundle report to ${outputPath}`);
