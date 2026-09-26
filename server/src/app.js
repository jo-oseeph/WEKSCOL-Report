import express from "express";
import cors from "cors";
import morgan from "morgan";
import createAuthRoutes from "../routes/authRoutes.js";
import requireAuth from "../middleware/authMiddleware.js";
import createReportsRoutes from "./modules/reportRoutes.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import { createContainer } from "./bootstrap/container.js";
export default async function createApp() {
  const container = await createContainer();
  const app = express();
  app.use(cors({ origin: container.config.clientUrls, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(morgan("dev"));
  app.get("/", (request, response) =>
    response.json({ ok: true, service: "wescol-report-server" }),
  );
  app.get("/api/health", (request, response) => response.json({ ok: true }));
  app.use("/api/auth", createAuthRoutes(container.authController));
  app.use(
    "/api/reports",
    requireAuth({
      sessionService: container.sessionService,
      cookieName: container.config.session.cookieName,
    }),
    createReportsRoutes(container.reportsController),
  );
  app.use(notFound);
  app.use(errorHandler);
  return { app, container };
}
