import express from "express";
import { studentDashboardRoute } from "./student/dashboard.js";

const router = express.Router();

router.use("/dashboard", studentDashboardRoute);
router.get("/", (_req, res) => {
    res.json({ 
        success: true,
        list: [
          "POST /beranda",
          "POST /kelas",
          "POST /kalender-akademik",
          "POST /pencapaian",
          "POST /profile",
          "POST /list"
        ]
    });
});

export const studentRoute = router;