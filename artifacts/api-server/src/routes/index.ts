import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mikrotikRouter from "./mikrotik";
import chatRouter from "./chat";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Health endpoint stays public for liveness checks
router.use(healthRouter);

// All MikroTik and chat operations require an authenticated session
router.use(requireAuth, mikrotikRouter);
router.use(requireAuth, chatRouter);

export default router;
