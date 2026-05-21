import fs from "fs";
import os from "os";
import path from "path";
import { buildPdfIndexRowsFromFile } from "../services/pdfIndexService.js";

const repoRoot = path.resolve("..");
const benchmarkDir = path.resolve(process.argv[2] || repoRoot);
const concurrency = Math.max(Number(process.env.PDF_BENCHMARK_CONCURRENCY || 2), 1);

const listPdfFiles = (targetDir) =>
  fs
    .readdirSync(targetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => path.join(targetDir, entry.name))
    .sort();

const runWithConcurrency = async (items, limit, handler) => {
  const results = [];
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await handler(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
};

const main = async () => {
  const files = listPdfFiles(benchmarkDir);
  if (!files.length) {
    throw new Error(`No PDF files found in ${benchmarkDir}`);
  }

  const startedAt = Date.now();
  const results = await runWithConcurrency(files, concurrency, async (filePath) => {
    const fileStartedAt = Date.now();
    const stat = fs.statSync(filePath);
    const { rows, stats } = await buildPdfIndexRowsFromFile(filePath, path.basename(filePath));
    const memory = process.memoryUsage();

    return {
      file: path.basename(filePath),
      sizeBytes: stat.size,
      chunks: rows.length,
      pages: stats.pages,
      extractionMode: stats.extractionMode,
      parseDurationMs: stats.parseDurationMs,
      wallClockMs: Date.now() - fileStartedAt,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
    };
  });

  const totals = results.reduce(
    (acc, item) => {
      acc.files += 1;
      acc.sizeBytes += item.sizeBytes;
      acc.chunks += item.chunks;
      acc.pages += item.pages;
      acc.totalParseDurationMs += item.parseDurationMs;
      acc.maxParseDurationMs = Math.max(acc.maxParseDurationMs, item.parseDurationMs);
      return acc;
    },
    {
      files: 0,
      sizeBytes: 0,
      chunks: 0,
      pages: 0,
      totalParseDurationMs: 0,
      maxParseDurationMs: 0,
    }
  );

  const summary = {
    benchmarkDir,
    concurrency,
    cpuCount: os.cpus().length,
    elapsedMs: Date.now() - startedAt,
    throughputFilesPerSecond: Number((totals.files / Math.max((Date.now() - startedAt) / 1000, 0.001)).toFixed(2)),
    totals,
    results,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exit(1);
});
