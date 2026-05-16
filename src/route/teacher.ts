import express, { query } from "express";
import * as teacher from './teacher/index.js';

const router = express.Router();

for (const route of Object.values(teacher)) {
  router.use(`/${route.path}`, route.router);
}

export default {
    path: '/teacher',
    router
};