import express from "express";
import cors from "cors";
import morgan from "morgan";
import loadConfig from "./config/env.js";
import createDatabase from "./db/connection.js";
import runMigrations from "./db/migrate.js";
import createUserRepository from "./db/userRepository.js";
import createPasswordResetTokenRepository from "./db/passwordResetTokenRepository.js";
import createSessionRepository from "./db/sessionRepository.js";
import createAuthController from "./controllers/authController.js";
import createReportController from "./controllers/reportController.js";
import createAuthRoutes from "./routes/authRoutes.js";
import createAuthService from "./services/authService.js";
import createSessionService from "./services/sessionService.js";
import createEmailService from "./services/emailService.js";
import createReportRoutes from "./routes/reportRoutes.js";
import requireAuth from "./middleware/authMiddleware.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";

const config = loadConfig();

const verifyEmailConnection = (emailService) => {
  if (!emailService.isConfigured) {
    console.warn(
      "Password reset email is disabled: configure SMTP_USER and SMTP_PASSWORD in the server .env file.",
    );
    return;
  }

  emailService.verifyConnection().then((result) => {
    if (result.ok) {
      console.log("Gmail SMTP connection verified for password reset email.");
    } else {
      console.error("Gmail SMTP connection verification failed:", {
        code: result.code,
        message: result.reason,
      });
    }
  });
};

const startServer = async () => {
  console.log("Connecting to Neon Postgres...");
  const db = createDatabase(config.databaseUrl);
  await runMigrations(db);
  console.log("Neon database migrations are complete.");

  const userRepository = createUserRepository(db);
  const passwordResetTokenRepository =
    createPasswordResetTokenRepository(db);
  const sessionRepository = createSessionRepository(db);

  const sessionService = createSessionService({
    sessionRepository,
    userRepository,
    sessionConfig: config.session,
  });

  const emailService = createEmailService(config.email);

  const authService = createAuthService({
    userRepository,
    sessionService,
    passwordResetTokenRepository,
    emailService,
    clientUrl: config.clientUrl,
  });

  const authController = createAuthController({
    authService,
    sessionService,
    sessionConfig: config.session,
  });

  const reportController = createReportController();

  const app = express();

  // The frontend (Vercel) and backend (Render) are deployed on different
  // origins in production, so the browser requires an explicit CORS grant.
  // "credentials: true" is required so the session cookie is sent/accepted
  // cross-origin; this must be paired with SameSite=None on the cookie
  // itself (see utils/cookies.js) and a specific (non-wildcard) origin,
  // since browsers reject "Access-Control-Allow-Origin: *" alongside
  // credentialed requests.
  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "32kb" }));
  app.use(morgan("dev"));

  app.use("/api/auth", createAuthRoutes(authController));

  app.use(
    "/api/reports",
    requireAuth({
      sessionService,
      cookieName: config.session.cookieName,
    }),
    createReportRoutes(reportController),
  );

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`WESCOL server listening on http://localhost:${config.port}`);
    verifyEmailConnection(emailService);
  });

  server.on("error", async (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(
        `WESCOL server could not start: port ${config.port} is already in use. Stop the existing server or use a different PORT.`,
      );
    } else {
      console.error("WESCOL server failed:", {
        code: error?.code,
        message: error?.message,
      });
    }

    await db.end();
    process.exit(1);
  });

  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) return;

    isShuttingDown = true;
    console.warn(`WESCOL server received ${signal}; shutting down.`);

    server.close(async () => {
      await db.end();
      process.exit(0);
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  process.on("uncaughtException", (error) => {
    console.error("WESCOL server encountered an uncaught exception:", error);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    console.error(
      "WESCOL server encountered an unhandled promise rejection:",
      reason,
    );
  });
};

startServer().catch((error) => {
  console.error("WESCOL server could not start:", {
    code: error?.code,
    message: error?.message,
  });
  process.exit(1);
});