import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { getHomePath, isValidId, readStoredAccount } from "../utils/navigation.js";

export default function RequireAccount({ role, children }) {
  const { id } = useParams();
  const token = localStorage.getItem("access");
  const currentRole = localStorage.getItem("role");
  if (!token || currentRole !== role || !isValidId(readStoredAccount(role)?.id)) {
    const destination = token && currentRole !== role ? getHomePath()
      : role === "livreur" ? "/inscription-livreur" : "/connexion-client";
    return <Navigate to={destination} replace />;
  }
  if (id !== undefined && !isValidId(id)) return <Navigate to={getHomePath()} replace />;
  return children;
}
