import security from "../utils/security.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const registrationError =
  "Complete all fields and use a password with at least 6 characters.";

const toUser = (user) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  email: user.email,
  idNumber: user.id_number,
  avatarUrl: user.avatar_url || null,
});

const createServiceError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

function requiredText(value, fieldName, maxLength = 120) {
  if (typeof value !== "string" || !value.trim()) {
    throw createServiceError(registrationError, 400);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw createServiceError(`${fieldName} is too long.`, 400);
  }
  return normalized;
}

function validateRegistration(details = {}) {
  const firstName = requiredText(details.firstName, "First name", 80);
  const lastName = requiredText(details.lastName, "Last name", 80);
  const email = requiredText(details.email, "Email", 160).toLowerCase();
  const idNumber = requiredText(details.idNumber, "ID number", 80);
  const password = details.password;

  if (
    !emailPattern.test(email) ||
    typeof password !== "string" ||
    password.length < 6
  ) {
    throw createServiceError(registrationError, 400);
  }

  return { firstName, lastName, email, idNumber, password };
}

function validateLogin(credentials = {}) {
  const email =
    typeof credentials.email === "string"
      ? credentials.email.trim().toLowerCase()
      : "";
  const password =
    typeof credentials.password === "string" ? credentials.password : "";
  if (!email || !emailPattern.test(email) || !password) {
    throw createServiceError("Email or password is incorrect.", 401);
  }
  return { email, password };
}

function validateProfile(details = {}) {
  return {
    firstName: requiredText(details.firstName, "First name", 80),
    lastName: requiredText(details.lastName, "Last name", 80),
    email: requiredText(details.email, "Email", 160).toLowerCase(),
    idNumber: requiredText(details.idNumber, "ID number", 80),
    avatarUrl: typeof details.avatarUrl === "string" ? details.avatarUrl.trim() : "",
    password: typeof details.password === "string" ? details.password : "",
  };
}

const createAuthService = ({
  userRepository,
  sessionService,
  passwordResetTokenRepository,
  emailService,
  clientUrl,
  passwordSecurity = security,
}) => {
  const passwordResetTokenLifetime = 30 * 60 * 1000;

  return {
    async register(details) {
      const input = validateRegistration(details);
      if (
        await userRepository.findByEmail(input.email) ||
        await userRepository.findByIdNumber(input.idNumber)
      ) {
        throw createServiceError("That email or ID number is already registered.", 409);
      }

      try {
        const user = await userRepository.create({
          ...input,
          avatarUrl: input.avatarUrl,
          passwordHash: await passwordSecurity.hashPassword(input.password),
        });
        return toUser(user);
      } catch (error) {
        if (error?.code === "23505") {
          throw createServiceError("That email or ID number is already registered.", 409);
        }
        throw error;
      }
    },
    async login(credentials) {
      const { email, password } = validateLogin(credentials);
      const user = await userRepository.findByEmail(email);
      if (
        !user ||
        !(await passwordSecurity.comparePassword(password, user.password_hash))
      ) {
        throw createServiceError("Email or password is incorrect.", 401);
      }
      return {
        user: toUser(user),
        token: await sessionService.createSession(user.id),
      };
    },
    async updateProfile(userId, details) {
      const input = validateProfile(details);
      if (input.password && input.password.length < 6) {
        throw createServiceError("Use a password with at least 6 characters.", 400);
      }

      const emailOwner = await userRepository.findByEmail(input.email);
      const idOwner = await userRepository.findByIdNumber(input.idNumber);
      if ((emailOwner && emailOwner.id !== userId) || (idOwner && idOwner.id !== userId)) {
        throw createServiceError("That email or ID number is already in use.", 409);
      }

      try {
        const user = await userRepository.updateProfile({ ...input, id: userId });
        if (input.password) {
          await passwordSecurity.hashPassword(input.password).then((hash) =>
            userRepository.updatePassword(userId, hash),
          );
        }
        return toUser(await userRepository.findById(user.id));
      } catch (error) {
        if (error?.code === "23505") {
          throw createServiceError("That email or ID number is already in use.", 409);
        }
        throw error;
      }
    },
    async changePassword(userId, details = {}) {
      const currentPassword = typeof details.currentPassword === "string" ? details.currentPassword : "";
      const newPassword = typeof details.newPassword === "string" ? details.newPassword : "";
      const confirmPassword = typeof details.confirmPassword === "string" ? details.confirmPassword : "";
      const user = await userRepository.findById(userId);

      if (!user || !currentPassword || !newPassword || newPassword.length < 6) {
        throw createServiceError("Use a new password with at least 6 characters.", 400);
      }
      if (newPassword !== confirmPassword) {
        throw createServiceError("New passwords do not match.", 400);
      }
      if (!(await passwordSecurity.comparePassword(currentPassword, user.password_hash))) {
        throw createServiceError("The current password is incorrect.", 400);
      }

      await userRepository.updatePassword(
        userId,
        await passwordSecurity.hashPassword(newPassword),
      );
    },
    async requestPasswordReset(details = {}) {
      const email =
        typeof details.email === "string" ? details.email.trim().toLowerCase() : "";
      if (!emailPattern.test(email)) return;

      await passwordResetTokenRepository.deleteExpired(Date.now());
      const user = await userRepository.findByEmail(email);
      if (!user) return;

      const token = passwordSecurity.createResetToken();
      const now = Date.now();
      await passwordResetTokenRepository.deleteForUser(user.id);
      await passwordResetTokenRepository.create({
        tokenHash: passwordSecurity.hashToken(token),
        userId: user.id,
        expiresAt: now + passwordResetTokenLifetime,
        createdAt: now,
      });

      try {
        const resetUrl = `${clientUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
        await emailService.sendPasswordReset({ to: user.email, resetUrl });
      } catch (error) {
        try {
          await passwordResetTokenRepository.deleteForUser(user.id);
        } catch (cleanupError) {
          console.error("Unable to remove password reset token after email failure:", {
            code: cleanupError?.code,
            message: cleanupError?.message,
          });
        }

        console.error("Unable to send password reset email:", {
          code: error?.code,
          responseCode: error?.responseCode,
          message: error?.message,
        });
        throw createServiceError(
          "Password reset email service is temporarily unavailable. Please try again later.",
          503,
        );
      }
    },
    async resetPassword(details = {}) {
      const token = typeof details.token === "string" ? details.token.trim() : "";
      const newPassword = typeof details.newPassword === "string" ? details.newPassword : "";
      const confirmPassword = typeof details.confirmPassword === "string" ? details.confirmPassword : "";

      if (!token || newPassword.length < 6) {
        throw createServiceError("Use a password with at least 6 characters.", 400);
      }
      if (newPassword !== confirmPassword) {
        throw createServiceError("Passwords do not match.", 400);
      }

      await passwordResetTokenRepository.deleteExpired(Date.now());
      const resetToken = await passwordResetTokenRepository.consume(
        passwordSecurity.hashToken(token),
        Date.now(),
      );
      if (!resetToken) {
        throw createServiceError("This password reset link is invalid or has expired.", 400);
      }

      await userRepository.updatePassword(
        resetToken.user_id,
        await passwordSecurity.hashPassword(newPassword),
      );
      await sessionService.deleteUserSessions(resetToken.user_id);
    },
  };
};

export default createAuthService;
