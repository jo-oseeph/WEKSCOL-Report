import express from "express";
import morgan from "morgan";
import loadConfig from "./config/env.js";
import createDatabase from "./db/connection.js";
import runMigrations from "./db/migrate.js";
import createUserRepository from "./db/userRepository.js";
import createPasswordResetTokenRepository from "./db/passwordResetTokenRepository.js";
import createSessionRepository from "./db/sessionRepository.js";
import createAuthController from "./controllers/authController.js";
import createAuthRoutes from "./routes/authRoutes.js";
import createAuthService from "./services/authService.js";
import createSessionService from "./services/sessionService.js";
import createEmailService from "./services/emailService.js";
import createReportRoutes from "./routes/reportRoutes.js";
import requireAuth from "./middleware/authMiddleware.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";

const config = loadConfig();
const db = createDatabase(config.databasePath);
runMigrations(db);

const userRepository = createUserRepository(db);
const passwordResetTokenRepository = createPasswordResetTokenRepository(db);
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

if (!emailService.isConfigured) {
  console.warn(
    "Password reset email is disabled: configure SMTP_USER and SMTP_PASSWORD in the server .env file.",
  );
} else {
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
}
const authController = createAuthController({
  authService,
  sessionService,
  sessionConfig: config.session,
});

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(morgan("dev"));
app.use("/api/auth", createAuthRoutes(authController));
app.use(
  "/api/reports",
  requireAuth({ sessionService, cookieName: config.session.cookieName }),
  createReportRoutes(),
);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`WESCOL server listening on http://localhost:${config.port}`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
