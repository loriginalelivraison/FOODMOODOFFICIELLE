import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import RouteRecovery from './components/RouteRecovery.jsx'
import './styles.css'
import './driver.css'

const router = createBrowserRouter([
  {
    path: "*",
    element: <App />,
    errorElement: <RouteRecovery />,
  },
]);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
