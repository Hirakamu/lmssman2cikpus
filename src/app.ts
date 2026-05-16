import cors from "cors";
import express from "express";
import { lmsfs } from "./lib/filesystem.js";
import * as route from "./route/index.js";
import { ApiError, responseHandler } from "./lib/routeHandler.js";
//import { firstRun } from "./lib/firstRun.js";

// Mother of the app
const app = express();

// Initialize the filesystem module
//firstRun();
lmsfs.init();

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Register routes
for (const rout of Object.values(route)) {
  app.use(rout.path, rout.router);
}

// Catch-all for undefined routes
app.all("*", (req, res, next) => { next(new ApiError(404, `Endpoint not found, ${req.originalUrl}.`)); });

// Global response handler
app.use(responseHandler);

export { app };
