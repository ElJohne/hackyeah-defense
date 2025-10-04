import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const polandCenter = [52.0976, 19.1451];
  const polandZoom = 6;
  const polandBounds = [
    [48.9965, 14.1229],
    [54.8356, 24.1458],
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Drone Risk Dashboard</h1>
      </header>
      <div className="app-body">
        <aside className="sidebar" aria-label="Target list" />
        <main className="map-wrapper" aria-label="Map display">
          <MapContainer
            center={polandCenter}
            zoom={polandZoom}
            bounds={polandBounds}
            className="map-container"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </MapContainer>
        </main>
      </div>
    </div>
  );
}

export default App;
