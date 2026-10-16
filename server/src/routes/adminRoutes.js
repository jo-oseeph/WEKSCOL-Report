import { Router } from "express";

const createAdminRoutes = (controller) => {
  const router = Router();
  router.get("/overview", controller.overview);
  router.get("/activity/live", controller.liveActivity);
  router.get("/users", controller.listUsers);
  router.get("/reports", controller.listReports);
  router.get("/catalog", controller.catalog);
  router.get("/activity", controller.activity);
  router.get("/activity/export.csv", controller.exportActivity);
  router.get("/presets", controller.listPresets);
  router.post("/presets", controller.createPreset);
  router.delete("/presets/:presetId", controller.deletePreset);
  router.get("/users/:userId/permissions", controller.getPermissions);
  router.get("/users/:userId/access", controller.getAccess);
  router.patch("/users/:userId/status", controller.updateStatus);
  router.patch("/users/:userId/approve", (request, response, next) => {
    request.body = { ...(request.body || {}), status: "approved" };
    return controller.updateStatus(request, response, next);
  });
  router.patch("/users/:userId/reject", (request, response, next) => {
    request.body = { ...(request.body || {}), status: "rejected" };
    return controller.updateStatus(request, response, next);
  });
  router.patch("/users/:userId/suspend", (request, response, next) => {
    request.body = { ...(request.body || {}), status: "suspended" };
    return controller.updateStatus(request, response, next);
  });
  router.patch("/users/:userId/restore", (request, response, next) => {
    request.body = { ...(request.body || {}), status: "approved" };
    return controller.updateStatus(request, response, next);
  });
  router.put("/users/:userId/permissions", controller.updatePermissions);
  router.put("/users/:userId/access", controller.updateAccess);
  router.patch("/catalog/reports/:reportId/active", controller.updateReportActive);
  return router;
};

export default createAdminRoutes;