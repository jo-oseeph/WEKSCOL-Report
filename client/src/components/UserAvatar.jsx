import React, { useRef, useState } from "react";

const MAX_AVATAR_SIZE = 24000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read that image."));
    reader.readAsDataURL(file);
  });
}

function resizeAvatar(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 256 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (let quality = 0.82; quality >= 0.3; quality -= 0.08) {
        const result = canvas.toDataURL("image/jpeg", quality);
        if (result.length <= MAX_AVATAR_SIZE) {
          resolve(result);
          return;
        }
      }

      reject(new Error("That image is too detailed. Choose a smaller image."));
    };
    image.onerror = () => reject(new Error("Choose a valid image file."));
    image.src = dataUrl;
  });
}

export async function prepareAvatar(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Choose an image smaller than 5 MB.");
  }
  return resizeAvatar(await readFileAsDataUrl(file));
}

export function UserAvatar({ user, initials, className }) {
  return user?.avatarUrl ? (
    <div className={className}>
      <img src={user.avatarUrl} alt="" className="site-user-avatar-image" />
    </div>
  ) : (
    <div className={className}>{initials}</div>
  );
}

export function AvatarPicker({ user, initials, onChange, className }) {
  const inputRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setIsSaving(true);
    try {
      await onChange(await prepareAvatar(file));
    } catch (changeError) {
      setError(changeError.message || "Unable to update the profile photo.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="site-avatar-picker">
      <UserAvatar user={user} initials={initials} className={className} />
      <button
        type="button"
        className="site-avatar-change"
        onClick={() => inputRef.current?.click()}
        disabled={isSaving}
      >
        {isSaving ? "Preparing photo..." : "Change photo"}
      </button>
      <input
        ref={inputRef}
        className="site-avatar-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      {error ? <span className="site-avatar-error">{error}</span> : null}
    </div>
  );
}
