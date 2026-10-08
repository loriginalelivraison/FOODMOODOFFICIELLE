const vehicleIcons = {
  voiture: { className: "vehicle-marker vehicle-marker-car", html: '<span class="vehicle-map-image is-voiture" aria-hidden="true"></span>' },
  moto: { className: "vehicle-marker vehicle-marker-moto", html: '<span class="vehicle-map-image is-moto" aria-hidden="true"></span>' },
  velo: { className: "vehicle-marker", html: '<span class="vehicle-marker-fallback">🚲</span>' },
  camion: { className: "vehicle-marker", html: '<span class="vehicle-marker-fallback">🚚</span>' },
};

export function getVehicleMarkerIcon(vehicle) {
  return vehicleIcons[vehicle] || vehicleIcons.moto;
}
