// ============================================================================
// Public Lab Service
// ============================================================================
import apiClient from "../../../Core/http/api.client";

export const labService = {
  // Public search approved laboratories with city/query filter
  async getLabs({ search = "", city = "", limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (city) params.append("city", city);
    if (limit) params.append("limit", limit);
    if (offset) params.append("offset", offset);

    return await apiClient.get(`/labs?${params.toString()}`);
  },

  // Public get lab details by id
  async getLabById(labId) {
    return await apiClient.get(`/labs/${labId}`);
  },
};
