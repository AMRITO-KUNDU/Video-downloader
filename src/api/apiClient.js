/**
 * VidGrab API Client
 * Handles communication with the backend + localStorage persistence
 */

function getStorage(key, defaultValue = []) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Storage save failed:", err);
  }
}

export const apiClient = {
  // ======================
  // Download related
  // ======================

  async getFormats(url) {
    const response = await fetch(`/api/formats?url=${encodeURIComponent(url)}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || "Failed to fetch formats");
    }

    return response.json();
  },

  async getDirectUrl({ url, formatId, bitrate }) {
    if (!url) throw new Error("URL is required");
    if (!formatId) throw new Error("Format ID is required");

    let urlWithParams = `/api/direct-url?url=${encodeURIComponent(url)}&format_id=${encodeURIComponent(formatId)}`;
    if (bitrate) {
      urlWithParams += `&bitrate=${encodeURIComponent(bitrate)}`;
    }
    const response = await fetch(urlWithParams);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || "Failed to get direct URL");
    }

    return response.json();
  },

  // ======================
  // Local storage entities
  // ======================

  entities: {
    SavedVideo: {
      async list() {
        return getStorage("vg_saved_videos", []);
      },

      async create(data) {
        const items = getStorage("vg_saved_videos", []);
        const newItem = {
          id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
          ...data,
        };
        items.unshift(newItem);
        setStorage("vg_saved_videos", items);
        return newItem;
      },

      async delete(id) {
        const items = getStorage("vg_saved_videos", []);
        setStorage(
          "vg_saved_videos",
          items.filter((item) => item.id !== id)
        );
        return { success: true };
      },
    },

    Conversation: {
      async list() {
        return getStorage("vg_conversations", []);
      },

      async create(data) {
        const items = getStorage("vg_conversations", []);
        const newItem = {
          id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
          ...data,
        };
        items.unshift(newItem);
        setStorage("vg_conversations", items);
        return newItem;
      },

      async delete(id) {
        const items = getStorage("vg_conversations", []);
        setStorage(
          "vg_conversations",
          items.filter((item) => item.id !== id)
        );
        return { success: true };
      },
    },
  },

  // ======================
  // Auth (simple guest mode)
  // ======================

  auth: {
    async me() {
      const user = localStorage.getItem("vg_user");
      return user
        ? JSON.parse(user)
        : { id: "guest", name: "Guest User", email: "guest@vidgrab.app" };
    },

    async login(email) {
      const user = {
        id: `u_${Date.now()}`,
        name: email.split("@")[0],
        email,
      };
      localStorage.setItem("vg_user", JSON.stringify(user));
      return user;
    },

    async logout() {
      localStorage.removeItem("vg_user");
    },
  },
};
