import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import SplashScreen from './pages/SplashScreen.jsx'
import Couriers from './pages/Couriers.jsx'
import CourierRegister from './pages/CourierRegister.jsx'
import Tracking from './pages/Tracking.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import LivreurDashboard from "./pages/LivreurDashboard.jsx";
import NotFound from './pages/NotFound.jsx'
import React from "react";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/livreurs" element={<Couriers />} />
        <Route path="/inscription-livreur" element={<CourierRegister />} />
        <Route path="/livreur-dashboard/:id" element={<LivreurDashboard />} />
        <Route path="/tracking/:id" element={<Tracking />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
