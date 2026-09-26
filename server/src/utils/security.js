import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const createSessionToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const createResetToken = createSessionToken;

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const hashPassword = (password) => {
  return bcrypt.hash(password, 12);
};

const comparePassword = (password, passwordHash) => {
  return bcrypt.compare(password, passwordHash);
};

export { comparePassword, createResetToken, createSessionToken, hashPassword, hashToken };
export default { comparePassword, createResetToken, createSessionToken, hashPassword, hashToken };