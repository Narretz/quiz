#!/usr/bin/env node
import { program } from "commander";
import { parseQuiz } from "./parse-quiz.js";
import { generatePptx } from "./generate-pptx.js";

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString()));
    process.stdin.on("error", reject);
  });
}

program.name("quiz").description("Quiz XLSX parser and PPTX generator");

program
  .command("parse")
  .description("Parse an XLSX quiz file to JSON")
  .argument("<file>", "path to .xlsx file")
  .action(async (file) => {
    const quiz = await parseQuiz(file);
    console.log(JSON.stringify(quiz, null, 2));
  });

program
  .command("generate")
  .description("Generate a PPTX from quiz JSON")
  .argument("[file]", "path to .xlsx or .json file (omit to read JSON from stdin)")
  .option("-o, --output <path>", "output .pptx path")
  .action(async (file, opts) => {
    let quiz;
    let defaultOut = "quiz.pptx";

    if (file?.endsWith(".xlsx")) {
      quiz = await parseQuiz(file);
      defaultOut = file.replace(/\.xlsx$/i, ".pptx");
    } else if (file) {
      const { readFileSync } = await import("fs");
      quiz = JSON.parse(readFileSync(file, "utf-8"));
      defaultOut = file.replace(/\.json$/i, ".pptx");
    } else {
      quiz = JSON.parse(await readStdin());
    }

    const outFile = opts.output || defaultOut;
    await generatePptx(quiz, outFile);
    console.error("Written to", outFile);
  });

program
  .command("web")
  .description("Start a local web UI for uploading XLSX and downloading PPTX")
  .option("-p, --port <number>", "port number", "3003")
  .option("--no-reload", "disable live reload on file changes")
  .action(async (opts) => {
    const http = await import("http");
    const fs = await import("fs");
    const path = await import("path");
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")));

    const mimeTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
    };

    // Live reload: browsers subscribe via SSE; file changes push "css" (swap
    // stylesheets in place) or "reload" (full page reload).
    const reloadClients = new Set();
    const reloadScript = `<script>
      (() => {
        let connected = false;
        const es = new EventSource("/__reload");
        es.onopen = () => { if (connected) location.reload(); connected = true; }; // server restarted
        es.onmessage = (e) => {
          if (e.data !== "css") return location.reload();
          for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
            const url = new URL(link.href);
            url.searchParams.set("t", Date.now());
            link.href = url;
          }
        };
      })();
    </script>`;

    if (opts.reload) {
      const ignored = /^(node_modules|\.git|test-results|playwright-report|quizzes|tmp)(\/|$)/;
      let changed = new Set();
      let timer;
      fs.watch(root, { recursive: true }, (_event, filename) => {
        if (!filename || ignored.test(filename)) return;
        changed.add(filename);
        clearTimeout(timer);
        timer = setTimeout(() => {
          const msg = [...changed].every((f) => f.endsWith(".css")) ? "css" : "reload";
          changed = new Set();
          for (const client of reloadClients) client.write(`data: ${msg}\n\n`);
        }, 100);
      });
    }

    const server = http.createServer((req, res) => {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (opts.reload && pathname === "/__reload") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store" });
        res.write(": connected\n\n");
        reloadClients.add(res);
        req.on("close", () => reloadClients.delete(res));
        return;
      }
      const url = pathname === "/" ? "/index.html" : pathname;
      const filePath = path.join(root, url);

      // Only serve files under project root
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath);
        if (opts.reload && ext === ".html") {
          data = data.toString().replace("</body>", `${reloadScript}\n</body>`);
        }
        res.writeHead(200, {
          "Content-Type": mimeTypes[ext] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(data);
      });
    });

    const port = parseInt(opts.port);
    server.listen(port, () => {
      console.log(`Quiz web UI running at http://localhost:${port}${opts.reload ? " (live reload)" : ""}`);
    });
  });

program.parse();
