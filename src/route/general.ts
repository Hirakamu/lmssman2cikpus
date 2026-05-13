import Router from "express";
import { logger } from "../lib/logger.js";
import { env } from "../lib/env.js";

const router = Router();

if (env.LOG_LEVEL === "debug") {
  router.use((req, res, next) => {
    const startedAt = Date.now();
    const getIp = () => {
      return (
        req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
        req.socket?.remoteAddress ||
        req.ip ||
        "unknown"
      );
    };

    res.on("finish", () => {
      const latency = Date.now() - startedAt;
      const ip = getIp();
      logger.debug(`${ip} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${latency}ms)`,);
    });

    next();
  });
  router.get("/file/:id", (req, res, next) => {
    const fileName = String(req.params.id).replace(/[^a-zA-Z0-9._-]/g, "");
    if (!fileName)
      return res.status(400).json({ message: "Invalid file name" });

    const filePath = `${process.cwd()}//file//${fileName}`;
    res.download(filePath, fileName, (err) => {
      if (err) next(err);
    });
  });
}

router.get("/", (req, res) => {
  res.type("html").send(
    `<!doctype html>
  <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>School LMS API</title>
    </head>
    <body>
      <h1>Selamat datang di API LMS SMAN 2 Cikarang Pusat.</h1>
      <p>Version: ${env.VERSION}</p>
    </body>
  </html>`);
},
);

router.all("/servertime", (_req, res) => {
  const now = new Date();
  const pad = (value: number, length = 2) => value.toString().padStart(length, "0");
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",];

  res.json({
    day: days[now.getDay()],
    date: now.getDate(),
    month: months[now.getMonth()],
    year: now.getFullYear(),
    time: {
      hours: pad(now.getHours()),
      minutes: pad(now.getMinutes()),
      seconds: pad(now.getSeconds()),
      milliseconds: pad(now.getMilliseconds(), 3),
    },
  });
});

router.all("/robots.txt", (req, res) => {
  res.type("text").send(
    `User-agent: *
Disallow: /`,
  );
});

router.all("/favicon.ico", (req, res) => {
  res.status(204).end();
});

router.all("/version", (req, res) => {
  res.json({ version: env.VERSION });
});

router.all("/ping", (req, res) => {
  res.json({ status: "ok" });
});

export const generalRoute = router;