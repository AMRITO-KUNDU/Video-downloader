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
  // Get available formats for a video (NEW - Direct link architecture)
  async getFormats(url) {
    const response = await fetch(`/api/formats?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || "Failed to fetch formats");
    }
    return await response.json();
  },

  // Get direct download URL for a specific format (NEW - Direct link architecture)
  async getDirectUrl({ url, formatId }) {
    if (!url) throw new Error("URL is required");
    if (!formatId) throw new Error("Format ID is required");
    
    const response = await fetch(`/api/direct-url?url=${encodeURIComponent(url)}&format_id=${encodeURIComponent(formatId)}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || "Failed to get direct URL");
    }
    return await response.json();
  },

  // Download Video API endpoint (LEGACY - Kept for backward compatibility)
  async downloadVideo({ url, format = "mp4", quality = "720p" }) {
    console.warn("apiClient.downloadVideo() is deprecated. Use getDirectUrl() instead.");
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format, quality }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Download request failed");
    return data;
  },

  // Local storage based entity repositories
  entities: {
    SavedVideo: {
      async list() {
        return getStorage("vg_saved_videos", []);
      },
      async create(data) {
        const items = getStorage("vg_saved_videos", []);
        const newItem = { id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), ...data };
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
        const newItem = { id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), ...data };
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
