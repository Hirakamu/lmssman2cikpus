import express from "express";
import * as student from './student/index.js';

const router = express.Router();

for (const route of Object.values(student)) {
  router.use(`/${route.path}`, route.router);
}

export default {
    path: '/student',
    router
};