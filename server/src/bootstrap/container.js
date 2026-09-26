import loadConfig from "../config/env.js";
import createDatabase from "../db/connection.js";
import runMigrations from "../db/migrate.js";
import createUserRepository from "../db/userRepository.js";
import createPasswordResetTokenRepository from "../db/passwordResetTokenRepository.js";
import createReportPermissionRepository from "../db/reportPermissionRepository.js";
import createSessionRepository from "../db/sessionRepository.js";
import createAuthController from "../controllers/authController.js";
import createAdminController from "../controllers/adminController.js";
import createAdminService from "../services/adminService.js";
import createAuthService from "../services/authService.js";
import createSessionService from "../services/sessionService.js";
import createEmailService from "../services/emailService.js";
import createReportsController from "../modules/reportController.js";
import { loadModules } from "../modules/loadModules.js";

export async function createContainer() {
  const config = loadConfig();
  const db = createDatabase(config.databaseUrl);
  await runMigrations(db);
  const userRepository = createUserRepository(db);
  const sessionRepository = createSessionRepository(db);
  const passwordResetTokenRepository = createPasswordResetTokenRepository(db);
  const reportPermissionRepository = createReportPermissionRepository(db);
  const sessionService = createSessionService({
    sessionRepository,
    userRepository,
    reportPermissionRepository,
    sessionConfig: config.session,
  });
  const emailService = createEmailService(config.email);
  const authService = createAuthService({
    userRepository,
    sessionService,
    passwordResetTokenRepository,
    reportPermissionRepository,
    emailService,
    clientUrl: config.clientUrl,
  });
  const catalog = await loadModules();
  const reportCatalog = [...catalog.reports.values()];
  const adminService = createAdminService({
    userRepository,
    reportPermissionRepository,
    sessionService,
    reportIds: reportCatalog.map((report) => report.id),
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
    adminController: createAdminController({ adminService, reportCatalog }),
    reportsController: createReportsController(),
  };
}