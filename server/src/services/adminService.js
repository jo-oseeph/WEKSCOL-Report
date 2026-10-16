const allowedStatuses = new Set(["pending", "approved", "rejected", "suspended"]);

const serviceError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const toAdminUser = (user, permissions = [], access = {}) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  email: user.email,
  idNumber: user.id_number,
  avatarUrl: user.avatar_url || null,
  role: user.role,
  status: user.status,
  lastActiveAt: user.last_active_at || null,
  permissions,
  access,
});

const createAdminService = ({
  userRepository,
  sessionService,
  reportIds,
  reportCatalog,
  accessRepository,
  accessService,
  activityService,
  catalogRepository,
  presetRepository,
  activityRepository,
}) => {
  const allowedReportIds = new Set(reportIds.map(String));
  const reports = [...reportCatalog.values()];

  async function findUser(userId) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) throw serviceError("Invalid user ID.");
    const user = await userRepository.findById(id);
    if (!user) throw serviceError("User not found.", 404);
    return user;
  }

  async function serializeUser(user) {
    const [permissions, access] = await Promise.all([
      accessService.getEffectiveAccess(user),
      accessService.getUserAccess(user.id),
    ]);
    return toAdminUser(user, permissions, access);
  }

  async function changeStatus(userId, status, actorId) {
    if (!allowedStatuses.has(status)) throw serviceError("Invalid account status.");
    const user = await findUser(userId);
    if (user.role === "admin" && status !== "approved") {
      throw serviceError("An administrator account must remain approved.");
    }
    if (Number(user.id) === Number(actorId) && ["rejected", "suspended"].includes(status)) {
      throw serviceError("You cannot change your own administrator status.");
    }
    if (user.role === "admin" && ["rejected", "suspended"].includes(status)) {
      if ((await userRepository.countAdmins()) <= 1) {
        throw serviceError("The last administrator cannot be disabled.");
      }
    }
    const updated = await userRepository.updateStatus(user.id, status);
    if (status !== "approved") await sessionService.deleteUserSessions(user.id);
    await activityService.record({
      action: status === "approved" ? "approval" : status,
      userId: actorId,
      targetUserId: user.id,
      metadata: { previousStatus: user.status, status },
    });
    return serializeUser(updated);
  }

  return {
    async listUsers({ search = "", status, page = 1, pageSize = 25 } = {}) {
      const users = await userRepository.findAllForAdmin();
      const query = String(search).trim().toLowerCase();
      const filtered = users.filter((user) => {
        if (status && status !== "all" && user.status !== status) return false;
        if (!query) return true;
        return [user.first_name, user.last_name, user.email, user.id_number]
          .filter(Boolean).join(" ").toLowerCase().includes(query);
      });
      const limit = Math.max(1, Math.min(100, Number(pageSize) || 25));
      const currentPage = Math.max(1, Number(page) || 1);
      const start = (currentPage - 1) * limit;
      return {
        users: await Promise.all(filtered.slice(start, start + limit).map(serializeUser)),
        total: filtered.length,
        page: currentPage,
        pageSize: limit,
      };
    },
    async getPermissions(userId) {
      return { user: await serializeUser(await findUser(userId)) };
    },
    async getAccess(userId) {
      const user = await findUser(userId);
      return { user: await serializeUser(user), access: await accessService.getUserAccess(user.id) };
    },
    async updateStatus(userId, status, actorId) {
      return { user: await changeStatus(userId, status, actorId) };
    },
    async updatePermissions(userId, selectedReportIds, grantedBy) {
      if (!Array.isArray(selectedReportIds) || selectedReportIds.some((id) => !allowedReportIds.has(String(id)))) {
        throw serviceError("Report permissions must contain valid report IDs.");
      }
      const user = await findUser(userId);
      if (user.role !== "user" || user.status !== "approved") {
        throw serviceError("Report permissions can only be assigned to approved regular users.");
      }
      const existing = await accessService.getUserAccess(user.id);
      const overrides = [...new Set(selectedReportIds.map(String))].map((reportId) => ({ reportId, effect: "allow" }));
      await accessRepository.replaceForUser(user.id, { subcategoryIds: existing.subcategories, overrides }, grantedBy);
      await activityService.record({ action: "access_change", userId: grantedBy, targetUserId: user.id, metadata: { reportIds: selectedReportIds } });
      return { user: await serializeUser(user) };
    },
    async updateAccess(userId, payload, grantedBy) {
      const user = await findUser(userId);
      if (user.role === "admin") throw serviceError("Administrator access is managed automatically.");
      if (user.status !== "approved") throw serviceError("Access can only be assigned to approved users.");
      const selection = accessService.validateAccessSelection(payload || {});
      await accessRepository.replaceForUser(user.id, selection, grantedBy);
      await activityService.record({ action: "access_change", userId: grantedBy, targetUserId: user.id, metadata: selection });
      return { user: await serializeUser(user), access: await accessService.getUserAccess(user.id) };
    },
    async overview() {
      const [counts, recent, actionCounts] = await Promise.all([
        userRepository.countByStatus(),
        activityService.recent(7),
        activityRepository.countActionsSince(new Date().setHours(0, 0, 0, 0)),
      ]);
      return { users: counts, categories: new Set(reports.map((report) => report.categoryId)).size, reports: reports.length, reportsRunToday: actionCounts.run || 0, recentActivity: recent };
    },
    async catalog() {
      const states = await catalogRepository.getStates();
      const runCounts = await activityRepository.reportRunCountsSince(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return reports.map((report) => ({ ...report, active: states.get(String(report.id))?.is_active !== false, runsThisWeek: runCounts[report.id] || 0, updatedAt: states.get(String(report.id))?.updated_at || null }));
    },
    async setReportActive(reportId, isActive, actorId) {
      if (!allowedReportIds.has(String(reportId))) throw serviceError("Report not found.", 404);
      if (typeof isActive !== "boolean") throw serviceError("isActive must be a boolean.");
      const state = await catalogRepository.setActive(String(reportId), isActive, actorId);
      await activityService.record({ action: "catalog_change", userId: actorId, reportId: String(reportId), metadata: { isActive } });
      return state;
    },
    listActivity(filters) { return activityService.list(filters); },
    listPresets() { return presetRepository.list(); },
    async createPreset(payload, createdBy) {
      const name = typeof payload?.name === "string" ? payload.name.trim() : "";
      if (!name || name.length > 120) throw serviceError("Preset name is required.");
      const selection = accessService.validateAccessSelection(payload || {});
      return presetRepository.create({ name, description: payload.description, ...selection, createdBy });
    },
    async deletePreset(id) {
      const presetId = Number(id);
      if (!Number.isInteger(presetId) || presetId < 1) throw serviceError("Invalid preset ID.");
      await presetRepository.remove(presetId);
    },
    reports,
  };
};

export default createAdminService;