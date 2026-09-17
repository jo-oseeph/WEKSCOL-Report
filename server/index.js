import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(directory, "data");
fs.mkdirSync(dataDirectory, { recursive: true });
const db = new Database(path.join(dataDirectory, "wescol.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, id_number TEXT NOT NULL UNIQUE, avatar_url TEXT, password_hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);",
);
const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "avatar_url")) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT;");
}
const sessionForeignKeys = db
  .prepare("PRAGMA foreign_key_list(sessions)")
  .all();
if (sessionForeignKeys.some((foreignKey) => foreignKey.from === "expires_at")) {
  db.pragma("foreign_keys = OFF");
  db.exec(
    "ALTER TABLE sessions RENAME TO sessions_legacy; CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL); INSERT INTO sessions (token_hash, user_id, expires_at) SELECT token_hash, user_id, expires_at FROM sessions_legacy; DROP TABLE sessions_legacy;",
  );
}
db.pragma("foreign_keys = ON");
const app = express();
app.use(express.json());
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 604800000,
};
const tokenHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const tokenFrom = (request) =>
  request.headers.cookie?.match(/(?:^|; )wescol_session=([^;]+)/)?.[1];
const userView = (user) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  email: user.email,
  idNumber: user.id_number,
  avatarUrl: user.avatar_url || null,
});
function currentUser(request) {
  const token = tokenFrom(request);
  const session =
    token &&
    db
      .prepare(
        "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
      )
      .get(tokenHash(token), Date.now());
  return session
    ? db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id)
    : null;
}
function setSessionCookie(response, token, maxAge = cookieOptions.maxAge) {
  const secure = cookieOptions.secure ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `wescol_session=${token}; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${secure}`,
  );
}
function startSession(response, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
    tokenHash(token),
    userId,
    Date.now() + cookieOptions.maxAge,
  );
  setSessionCookie(response, token);
}
app.get("/api/auth/me", (request, response) => {
  const user = currentUser(request);
  response.json({ user: user ? userView(user) : null });
});
app.post("/api/auth/register", async (request, response) => {
  const { firstName, lastName, email, idNumber, password, avatarUrl } = request.body;
  if (
    !firstName ||
    !lastName ||
    !email ||
    !idNumber ||
    !password ||
    password.length < 6
  )
    return response
      .status(400)
      .json({
        error:
          "Complete all fields and use a password with at least 6 characters.",
      });
  try {
    const result = db
      .prepare(
        "INSERT INTO users (first_name, last_name, email, id_number, avatar_url, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        firstName.trim(),
        lastName.trim(),
        email.trim().toLowerCase(),
        idNumber.trim(),
        avatarUrl?.trim() || null,
        await bcrypt.hash(password, 12),
      );
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(result.lastInsertRowid);
    response.status(201).json({ user: userView(user) });
  } catch (error) {
    response
      .status(error.code === "SQLITE_CONSTRAINT_UNIQUE" ? 409 : 500)
      .json({
        error:
          error.code === "SQLITE_CONSTRAINT_UNIQUE"
            ? "That email or ID number is already registered."
            : "Unable to create the account.",
      });
  }
});
app.put("/api/auth/profile", async (request, response) => {
  const currentUserRecord = currentUser(request);
  if (!currentUserRecord) {
    return response.status(401).json({ error: "You must be logged in." });
  }

  const { firstName, lastName, email, idNumber, avatarUrl, password } = request.body;
  if (!firstName || !lastName || !email || !idNumber) {
    return response.status(400).json({ error: "Name, email, and ID number are required." });
  }

  try {
    const updates = [
      "first_name = ?",
      "last_name = ?",
      "email = ?",
      "id_number = ?",
      "avatar_url = ?",
    ];
    const values = [
      firstName.trim(),
      lastName.trim(),
      email.trim().toLowerCase(),
      idNumber.trim(),
      avatarUrl?.trim() || null,
      currentUserRecord.id,
    ];

    if (password && password.length >= 6) {
      updates.push("password_hash = ?");
      values.splice(values.length - 1, 0, await bcrypt.hash(password, 12));
    }

    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
    db.prepare(query).run(...values);

    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(currentUserRecord.id);
    response.json({ user: userView(updatedUser) });
  } catch (error) {
    response
      .status(error.code === "SQLITE_CONSTRAINT_UNIQUE" ? 409 : 500)
      .json({
        error:
          error.code === "SQLITE_CONSTRAINT_UNIQUE"
            ? "That email or ID number is already in use."
            : "Unable to update the profile.",
      });
  }
});
app.put("/api/auth/password", async (request, response) => {
  const currentUserRecord = currentUser(request);
  if (!currentUserRecord) {
    return response.status(401).json({ error: "You must be logged in." });
  }

  const { currentPassword, newPassword, confirmPassword } = request.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return response.status(400).json({ error: "Use a new password with at least 6 characters." });
  }
  if (newPassword !== confirmPassword) {
    return response.status(400).json({ error: "New passwords do not match." });
  }
  if (!(await bcrypt.compare(currentPassword, currentUserRecord.password_hash))) {
    return response.status(400).json({ error: "The current password is incorrect." });
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    await bcrypt.hash(newPassword, 12),
    currentUserRecord.id,
  );
  response.json({ ok: true });
});
app.post("/api/auth/login", async (request, response) => {
  const user = db
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(request.body.email?.trim());
  if (
    !user ||
    !(await bcrypt.compare(request.body.password || "", user.password_hash))
  )
    return response
      .status(401)
      .json({ error: "Email or password is incorrect." });
  startSession(response, user.id);
  response.json({ user: userView(user) });
});
app.post("/api/auth/logout", (request, response) => {
  const token = tokenFrom(request);
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      tokenHash(token),
    );
  setSessionCookie(response, "", 0);
  response.json({ ok: true });
});
app.listen(3001, () =>
  console.log("WESCOL auth server listening on http://localhost:3001"),
);
