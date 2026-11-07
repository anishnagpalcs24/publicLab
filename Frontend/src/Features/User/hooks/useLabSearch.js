import { useState, useEffect, useCallback } from "react";
import { labService } from "../services/lab.service";

export function useLabSearch(initialCity = "") {
  const [labs, setLabs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 12, offset: 0 });

  const fetchLabs = useCallback(async (search = "", city = "", offset = 0) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await labService.getLabs({
        search,
        city,
        limit: 12,
        offset,
      });
      setLabs(res?.data || []);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.message || "Failed to load diagnostic laboratories");
      setLabs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabs(searchTerm, selectedCity, 0);
  }, [searchTerm, selectedCity, fetchLabs]);

  return {
    labs,
    searchTerm,
    setSearchTerm,
    selectedCity,
    setSelectedCity,
    isLoading,
    error,
    pagination,
    refetch: () => fetchLabs(searchTerm, selectedCity, pagination.offset),
  };
}
