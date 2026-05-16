import { lmsfs } from "./filesystem.js";
import { db } from "./database.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { buildSelectSQL } from "./schemaBuilder.js";
import * as tables from "./schema.js";

export const boot = () => {
    if (!env.FIRST_RUN) return;
    logger.info("Performing first run setup...");
    