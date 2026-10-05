const allowedStatuses = new Set(["pending", "approved", "rejected"]);

const toAdminUser = (user, permissions) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  email: user.email,
  idNumber: user.id_number,
  avatarUrl: user.avatar_url || null,
  role: user.role,
  status: user.status,
  permissions,
});

const createAdminService = ({ userRepository, reportPermissionRepository, sessionService, reportIds }) => {
  const allowedReportIds = new Set(reportIds);

  return {
    async listUsers() {
      const users = await userRepository.findAllForAdmin();
      return Promise.all(users.map(async (user) =>
        toAdminUser(user, await reportPermissionRepository.findForUser(user.id)),
      ));
    },

    async getPermissions(userId) {
      const user = await userRepository.findById(userId);
      if (!user) throw Object.assign(new Error("User not found."), { statusCode: 404 });
      return {
        userId: user.id,
        permissions: await reportPermissionRepository.findForUser(user.id),
      };
    },

    async updateStatus(userId, status) {
      if (!allowedStatuses.has(status)) {
        throw Object.assign(new Error("Invalid account status."), { statusCode: 400 });
      }
      const existingUser = await userRepository.findById(userId);
      if (!existingUser) {
        throw Object.assign(new Error("User not found."), { statusCode: 404 });
      }
      if (existingUser.role === "admin" && status !== "approved") {
        throw Object.assign(new Error("An administrator account must remain approved."), { statusCode: 400 });
      }

      const user = await userRepository.updateStatus(userId, status);
      if (!user) {
        throw Object.assign(new Error("User not found."), { statusCode: 404 });
      }
      if (status !== "approved") await sessionService.deleteUserSessions(userId);
      return toAdminUser(user, await reportPermissionRepository.findForUser(userId));
    },

    async updatePermissions(userId, selectedReportIds, grantedBy) {
      if (!Array.isArray(selectedReportIds) || selectedReportIds.some((reportId) => typeof reportId !== "string")) {
        throw Object.assign(new Error("Report permissions must be an array of report IDs."), { statusCode: 400 });
      }
      const uniqueReportIds = [...new Set(selectedReportIds)];
      if (uniqueReportIds.some((reportId) => !allowedReportIds.has(reportId))) {
        throw Object.assign(new Error("One or more selected reports do not exist."), { statusCode: 400 });
      }
      const user = await userRepository.findById(userId);
      if (!user) throw Object.assign(new Error("User not found."), { statusCode: 404 });
      if (user.role !== "user" || user.status !== "approved") {
        throw Object.assign(new Error("Report permissions can only be assigned to approved regular users."), { statusCode: 400 });
      }
      await reportPermissionRepository.replaceForUser(userId, uniqueReportIds, grantedBy);
      return toAdminUser(user, uniqueReportIds);
    },
  };
};

export default createAdminService;