import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

const KNOWN_SPA_ROUTES = new Set(["/", "/comparison", "/methodology"]);

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>404 Not Found</title></head>
<body>
<h1>404 – Page Not Found</h1>
<p><a href="/">Go to Climate Projections Explorer</a></p>
</body>
</html>`;

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("/{*any}", async (req, res, next) => {
    const url = req.originalUrl;

    // Only serve the SPA shell for known client routes; 404 everything else.
    if (!KNOWN_SPA_ROUTES.has(req.path)) {
      res.status(404).set({ "Content-Type": "text/html; charset=utf-8" }).end(NOT_FOUND_HTML);
      return;
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Only serve index.html for known SPA routes; return a real 404 for everything
  // else so crawlers and search engines receive an accurate HTTP status code
  // instead of treating a missing page as soft-404 content.
  app.use("/{*any}", (req, res) => {
    if (!KNOWN_SPA_ROUTES.has(req.path)) {
      res.status(404).set({ "Content-Type": "text/html; charset=utf-8" }).end(NOT_FOUND_HTML);
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
