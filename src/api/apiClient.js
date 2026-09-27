/**
 * Standalone VidGrab API Client
 * Replaces external SDKs with native fetch & localStorage persistence.
 */

// Helper to get/set localStorage items safely
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
  // Download Video API endpoint
  async downloadVideo({ url, format = "mp4", quality = "720p" }) {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format, quality }),
    });
    return response.json();
  },

  // Local storage based entity repositories
  entities: {
    SavedVideo: {
      async list() {
        return getStorage("vg_saved_videos", []);
      },
      async create(data) {
        const items = getStorage("vg_saved_videos", []);
        const newItem = { id: `sv_${Date.now()}`, createdAt: new Date().toISOString(), ...data };
        items.unshift(newItem);
        setStorage("vg_saved_videos", items);
        return newItem;
      },
      async delete(id) {
        const items = getStorage("vg_saved_videos", []);
        const filtered = items.filter(item => item.id !== id);
        setStorage("vg_saved_videos", filtered);
        return { success: true };
      }
    },
    Conversation: {
      async list() {
        return getStorage("vg_conversations", []);
      },
      async create(data) {
        const items = getStorage("vg_conversations", []);
        const newItem = { id: `conv_${Date.now()}`, createdAt: new Date().toISOString(), ...data };
        items.unshift(newItem);
        setStorage("vg_conversations", items);
        return newItem;
      },
      async delete(id) {
        const items = getStorage("vg_conversations", []);
        const filtered = items.filter(item => item.id !== id);
        setStorage("vg_conversations", filtered);
        return { success: true };
      }
    }
  },

  // Simple auth placeholder
  auth: {
    async me() {
      const user = localStorage.getItem("vg_user");
      return user ? JSON.parse(user) : { id: "guest", name: "Guest User", email: "guest@vidgrab.app" };
    },
    async login(email, password) {
      const user = { id: `u_${Date.now()}`, name: email.split("@")[0], email };
      localStorage.setItem("vg_user", JSON.stringify(user));
      return user;
    },
    async logout() {
      localStorage.removeItem("vg_user");
    }
  }
};
