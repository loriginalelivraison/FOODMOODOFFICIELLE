import React from "react";
import { Navigate } from "react-router-dom";
import { getHomePath } from "../utils/navigation.js";

export default function SplashScreen() {
  return <Navigate to={getHomePath()} replace />;
}