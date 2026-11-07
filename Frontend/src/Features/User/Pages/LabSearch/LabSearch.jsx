import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, MapPin, Building2, AlertCircle } from "lucide-react";
import LabCard from "../../Component/LabCard/LabCard";
import Input from "../../../../Shared/Component/Input/Input";
import Button from "../../../../Shared/Component/Button/Button";
import Loader from "../../../../Shared/Component/Loader/Loader";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { useLabSearch } from "../../hooks/useLabSearch";

const POPULAR_CITIES = ["All Cities", "Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Chennai"];

export default function LabSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cityParam = searchParams.get("city") || "";

  const {
    labs,
    searchTerm,
    setSearchTerm,
    selectedCity,
    setSelectedCity,
    isLoading,
    error,
  } = useLabSearch(cityParam);

  useEffect(() => {
    if (cityParam) {
      setSelectedCity(cityParam);
    }
  }, [cityParam, setSelectedCity]);

  const handleCitySelect = (city) => {
    const val = city === "All Cities" ? "" : city;
    setSelectedCity(val);
    if (val) {
      setSearchParams({ city: val });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="section" style={{ minHeight: "80vh" }}>
      <div className="container">
        {/* Header */}
        <div style={{ maxWidth: "680px", marginBottom: "2.5rem" }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <Badge variant="primary" icon={Building2}>Accredited Network</Badge>
          </div>
          <h1>Find Diagnostic Laboratories</h1>
          <p style={{ marginTop: "0.5rem" }}>
            Explore verified pathology centers, review contact credentials, and schedule diagnostic testing.
          </p>
        </div>

        {/* Filter Controls */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "1rem",
            marginBottom: "2rem",
            backgroundColor: "#FFFFFF",
            padding: "1.5rem",
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <Input
              placeholder="Search by laboratory name or keyword..."
              prefixIcon={Search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Input
              placeholder="Filter by city..."
              prefixIcon={MapPin}
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            />
          </div>

          {/* Quick City Pills */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>
              Quick Cities:
            </span>
            {POPULAR_CITIES.map((city) => {
              const isSelected =
                (city === "All Cities" && !selectedCity) ||
                selectedCity.toLowerCase() === city.toLowerCase();

              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => handleCitySelect(city)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    border: "1px solid",
                    borderColor: isSelected ? "#0F766E" : "#E2E8F0",
                    backgroundColor: isSelected ? "#CCFBF1" : "#FFFFFF",
                    color: isSelected ? "#0F766E" : "#475569",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results section */}
        {isLoading ? (
          <Loader text="Searching accredited diagnostic laboratories..." />
        ) : error ? (
          <div
            style={{
              padding: "2rem",
              borderRadius: "12px",
              backgroundColor: "#FEE2E2",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : labs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E2E8F0",
            }}
          >
            <Building2 size={48} color="#94A3B8" style={{ margin: "0 auto 1rem" }} />
            <h3>No Laboratories Found</h3>
            <p style={{ maxWidth: "420px", margin: "0.5rem auto 1.5rem" }}>
              We could not find verified diagnostic centers matching your current search parameters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSelectedCity("");
                setSearchParams({});
              }}
            >
              Clear Search Filters
            </Button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {labs.map((lab) => (
              <LabCard key={lab.id} lab={lab} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
