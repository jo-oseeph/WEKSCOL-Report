import loadConfig from "../config/env.js";
import createDatabase from "../../db/connection.js";
import runMigrations from "../../db/migrate.js";
import createUserRepository from "../../db/userRepository.js";
import createPasswordResetTokenRepository from "../../db/passwordResetTokenRepository.js";
import createSessionRepository from "../../db/sessionRepository.js";
import createAuthController from "../../controllers/authController.js";
import createAuthService from "../../services/authService.js";
import createSessionService from "../../services/sessionService.js";
import createEmailService from "../../services/emailService.js";
import createReportsController from "../modules/reportController.js";

export async function createContainer() {
  const config = loadConfig();
  const db = createDatabase(config.databaseUrl);
  await runMigrations(db);
  const userRepository = createUserRepository(db);
  const sessionRepository = createSessionRepository(db);
  const passwordResetTokenRepository = createPasswordResetTokenRepository(db);
  const sessionService = createSessionService({
    sessionRepository,
    userRepository,
    sessionConfig: config.session,
  });
  const emailService = createEmailService({
    provider: "gmail",
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
    fromName: "WESCOL Reports",
  });
  const authService = createAuthService({
    userRepository,
    sessionService,
    passwordResetTokenRepository,
    emailService,
    clientUrl: config.clientUrls[0],
  });
  return {
    config,
    db,
    sessionService,
    authController: createAuthController({
      authService,
      sessionService,
      sessionConfig: config.session,
    }),
    reportsController: createReportsController(),
  };
}

