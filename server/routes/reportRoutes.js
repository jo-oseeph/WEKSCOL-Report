import { Router } from "express";

const createReportRoutes = (controller, requireReportPermission) => {
  const router = Router();

  router.get("/catalog", controller.catalog);
  router.get("/filters", controller.filters);
  router.get("/:reportId/export.csv", requireReportPermission, controller.exportCsv);
  router.get("/:reportId/export.xlsx", requireReportPermission, controller.exportXlsx);
  router.get("/:reportId/export.pdf", requireReportPermission, controller.exportPdf);
  router.get("/:reportId", requireReportPermission, controller.run);

  return router;
};

export default createReportRoutes;
