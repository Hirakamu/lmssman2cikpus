import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.use(express.static(path.join(__dirname, "./alya")));

router.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "./alya/index.html"));
});

export const alyaRoute = router;