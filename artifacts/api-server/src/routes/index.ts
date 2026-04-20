import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mikrotikRouter from "./mikrotik";
import chatRouter from "./chat";
import adminRouter from "./admin";
import profilesRouter from "./profiles";

const router: IRouter = Router();

// Health endpoint stays public for liveness checks
router.use(healthRouter);

// Each subrouter applies its own auth + role middleware per-route.
router.use(mikrotikRouter);
router.use(chatRouter);
router.use(adminRouter);
router.use(profilesRouter);

export default router;
