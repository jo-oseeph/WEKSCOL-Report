import loadConfig from "../config/env.js";
import createDatabase from "../db/connection.js";
import runMigrations from "../db/migrate.js";
import createUserRepository from "../db/userRepository.js";
import createPasswordResetTokenRepository from "../db/passwordResetTokenRepository.js";
import createReportPermissionRepository from "../db/reportPermissionRepository.js";
import createAccessRepository from "../db/accessRepository.js";
import createActivityRepository from "../db/activityRepository.js";
import createCatalogRepository from "../db/catalogRepository.js";
import createPresetRepository from "../db/presetRepository.js";
import createSessionRepository from "../db/sessionRepository.js";
import createAuthController from "../controllers/authController.js";
import createAdminController from "../controllers/adminController.js";
import createAdminService from "../services/adminService.js";
import createAuthService from "../services/authService.js";
import createSessionService from "../services/sessionService.js";
import createEmailService from "../services/emailService.js";
import createAccessService from "../services/accessService.js";
import createActivityService from "../services/activityService.js";
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
  const accessRepository = createAccessRepository(db);
  const activityRepository = createActivityRepository(db);
  const catalogRepository = createCatalogRepository(db);
  const presetRepository = createPresetRepository(db);
  const catalog = await loadModules();
  const reportCatalog = [...catalog.reports.values()];
  const accessService = createAccessService({
    accessRepository,
    catalogRepository,
    reportCatalog: catalog.reports,
  });
  const activityService = createActivityService({ activityRepository });
  const sessionService = createSessionService({
    sessionRepository,
    userRepository,
    accessService,
    sessionConfig: config.session,
  });
  const emailService = createEmailService(config.email);
  const authService = createAuthService({
    userRepository,
    sessionService,
    passwordResetTokenRepository,
    reportPermissionRepository,
    accessService,
    activityService,
    emailService,
    clientUrl: config.clientUrl,
  });
  const adminService = createAdminService({
    userRepository,
    reportPermissionRepository,
    sessionService,
    reportIds: reportCatalog.map((report) => report.id),
    reportCatalog: catalog.reports,
    accessRepository,
    accessService,
    activityService,
    catalogRepository,
    presetRepository,
    activityRepository,
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
    reportsController: createReportsController({ accessService, activityService }),
    accessService,
  };
}