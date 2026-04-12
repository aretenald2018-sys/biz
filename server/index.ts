import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import aiRoutes from "./routes/ai";
import attachmentRoutes from "./routes/attachments";
import contractRoutes from "./routes/contracts";
import emailAttachmentRoutes from "./routes/email-attachments";
import generationRoutes from "./routes/generation";
import kanbanRoutes from "./routes/kanban";
import documentRoutes from "./routes/documents";
import scheduleRoutes from "./routes/schedules";
import searchRoutes from "./routes/search";
import ticketRoutes from "./routes/tickets";

const app = new Hono();
const isProduction = process.env.NODE_ENV === "production";
const distDir = path.resolve(process.cwd(), "dist");
const indexHtmlPath = path.join(distDir, "index.html");

app.route("/", aiRoutes);
app.route("/", attachmentRoutes);
app.route("/", contractRoutes);
app.route("/", emailAttachmentRoutes);
app.route("/", generationRoutes);
app.route("/", kanbanRoutes);
app.route("/", documentRoutes);
app.route("/", scheduleRoutes);
app.route("/", searchRoutes);
app.route("/", ticketRoutes);

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: error.message || "Internal Server Error" }, 500);
});

if (isProduction) {
  app.use(async (c, next) => {
    if (c.req.path.startsWith("/api/")) {
      return next();
    }

    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return next();
    }

    const requestPath = decodeURIComponent(c.req.path === "/" ? "/index.html" : c.req.path);
    const assetPath = path.resolve(distDir, `.${requestPath}`);

    if (assetPath.startsWith(distDir) && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return serveFile(assetPath);
    }

    if (fs.existsSync(indexHtmlPath)) {
      return serveFile(indexHtmlPath, "text/html; charset=utf-8");
    }

    return c.text("dist/index.html not found", 500);
  });
}

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Not Found" }, 404);
  }

  return c.text("Not Found", 404);
});

const port = Number(process.env.PORT ?? (isProduction ? 3000 : 3001));

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Hono server listening on http://localhost:${info.port}`);
  },
);

function serveFile(filePath: string, contentType = getContentType(filePath)) {
  return new Response(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": contentType,
    },
  });
}

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  return contentTypes[ext] ?? "application/octet-stream";
}
