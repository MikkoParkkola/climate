import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import { isDatabaseConfigured } from "./db";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  if (isDatabaseConfigured()) {
    try {
      const purgedRows = await storage.purgeIncompatibleModelCache();
      if (purgedRows > 0) {
        log(`purged ${purgedRows} incompatible climate_model_cache rows`);
      }
    } catch (err) {
      log(`failed to purge incompatible climate_model_cache rows: ${(err as Error).message}`);
    }
  } else {
    log("DATABASE_URL is not set; skipping climate_model_cache purge and serving DB-free routes only");
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Replit expects port 5000 by default; PORT lets local/prod smoke tests avoid
  // host-level conflicts without changing the deployment contract.
  const port = Number(process.env.PORT || 5000);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
