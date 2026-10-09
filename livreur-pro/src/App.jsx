import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import SplashScreen from './pages/SplashScreen.jsx'
import Couriers from './pages/Couriers.jsx'
import CourierRegister from './pages/CourierRegister.jsx'
import Tracking from './pages/Tracking.jsx'
import LivreurCourse from './pages/LivreurCourse.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import LivreurDashboard from "./pages/LivreurDashboard.jsx";
import RequireAccount from './components/RequireAccount.jsx'
import { getHomePath } from './utils/navigation.js'
import ClientAuth from "./pages/ClientAuth.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx";
import ClientCourse from "./pages/ClientCourse.jsx";
import PrivacyPolicy from './pages/privicy.jsx'
import React from "react";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/livreurs" element={<Couriers />} />
        <Route path="/inscription-livreur" element={<CourierRegister />} />
        <Route path="/livreur-dashboard/:id" element={<RequireAccount role="livreur"><LivreurDashboard /></RequireAccount>} />
        <Route path="/tracking/:id" element={<Tracking />} />
        <Route path="/course/:id" element={<RequireAccount role="client"><ClientCourse /></RequireAccount>} />
        <Route path="/livreur-course/:id" element={<RequireAccount role="livreur"><LivreurCourse /></RequireAccount>} />
        <Route path="/connexion-client" element={<ClientAuth />} />
        <Route path="/connexion-livreur" element={<Navigate to="/inscription-livreur" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/client-dashboard" element={<RequireAccount role="client"><ClientDashboard /></RequireAccount>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="*" element={<Navigate to={getHomePath()} replace />} />
      </Route>
    </Routes>
  )
}
