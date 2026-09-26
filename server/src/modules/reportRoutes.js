import { Router } from "express";

export default function createReportsRoutes(controller, requireReportPermission) {
  const router = Router();
  router.get("/catalog", controller.catalog);
  router.get("/filters", controller.filters);
  router.get("/:reportId/export.csv", requireReportPermission, controller.exportCsv);
  router.get("/:reportId/export.xlsx", requireReportPermission, controller.exportXlsx);
  router.get("/:reportId/export.pdf", requireReportPermission, controller.exportPdf);
  router.get("/:reportId", requireReportPermission, controller.run);
  return router;
}