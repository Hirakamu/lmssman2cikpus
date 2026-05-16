import express from "express";
import { localhostOnly } from "../../lib/localhostOnly.js";
import { asyncHandler, ApiError, ApiResponse } from "../../lib/routeHandler.js";
import { db } from "../../lib/database.js";
import { timetableData } from "../../lib/dataStructure.js";

const router = express.Router();

const initializeTimetable = async () => {
    const existing = await db.query(`SELECT 1 FROM timetable LIMIT 1`);
    if (existing.rowCount > 0) { return; }

