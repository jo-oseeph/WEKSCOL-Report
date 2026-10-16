function csv(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const createAdminController = ({ adminService, reportCatalog }) => ({
  async overview(request, response, next) {
    try { response.json(await adminService.overview()); } catch (error) { next(error); }
  },
  async liveActivity(request, response, next) {
    try { response.json({ activity: await adminService.listActivity({ page: 1, pageSize: 7 }) }); } catch (error) { next(error); }
  },
  async listUsers(request, response, next) {
    try { response.json(await adminService.listUsers(request.query)); } catch (error) { next(error); }
  },
  async listReports(request, response, next) {
    try { response.json({ reports: await adminService.catalog() }); } catch (error) { next(error); }
  },
  async getPermissions(request, response, next) {
    try { response.json(await adminService.getPermissions(request.params.userId)); } catch (error) { next(error); }
  },
  async getAccess(request, response, next) {
    try { response.json(await adminService.getAccess(request.params.userId)); } catch (error) { next(error); }
  },
  async updateStatus(request, response, next) {
    try { response.json(await adminService.updateStatus(request.params.userId, request.body?.status, request.user.id)); } catch (error) { next(error); }
  },
  async updatePermissions(request, response, next) {
    try { response.json(await adminService.updatePermissions(request.params.userId, request.body?.reportIds, request.user.id)); } catch (error) { next(error); }
  },
  async updateAccess(request, response, next) {
    try { response.json(await adminService.updateAccess(request.params.userId, request.body, request.user.id)); } catch (error) { next(error); }
  },
  async catalog(request, response, next) {
    try { response.json({ reports: await adminService.catalog(), registry: reportCatalog }); } catch (error) { next(error); }
  },
  async updateReportActive(request, response, next) {
    try { response.json({ state: await adminService.setReportActive(request.params.reportId, request.body?.isActive, request.user.id) }); } catch (error) { next(error); }
  },
  async activity(request, response, next) {
    try { response.json(await adminService.listActivity(request.query)); } catch (error) { next(error); }
  },
  async exportActivity(request, response, next) {
    try {
      const result = await adminService.listActivity({ ...request.query, page: 1, pageSize: 10000 });
      const lines = [["timestamp", "action", "actor", "target", "report", "metadata"].join(",")];
      for (const row of result.rows) {
        lines.push([
          new Date(Number(row.created_at)).toISOString(), row.action,
          row.actor_email || "", row.target_email || "", row.report_id || "",
          JSON.stringify(row.metadata || {}),
        ].map(csv).join(","));
      }
      response.type("text/csv").attachment("activity-log.csv").send(`\uFEFF${lines.join("\n")}\n`);
    } catch (error) { next(error); }
  },
  async listPresets(request, response, next) {
    try { response.json({ presets: await adminService.listPresets() }); } catch (error) { next(error); }
  },
  async createPreset(request, response, next) {
    try { response.status(201).json({ preset: await adminService.createPreset(request.body, request.user.id) }); } catch (error) { next(error); }
  },
  async deletePreset(request, response, next) {
    try { await adminService.deletePreset(request.params.presetId); response.json({ ok: true }); } catch (error) { next(error); }
  },
});

export default createAdminController;