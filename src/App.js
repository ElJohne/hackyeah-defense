import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const rawTargets = [
  {
    id: 1,
    name: 'Warsaw Central Rogue',
    lat: 52.2297,
    lon: 21.0122,
    riskFactors: {
      imeiModem: true,
      dataOnly: true,
      highSpeed: true,
      highHandover: true,
      verticalMovement: true,
      inNoFlyZone: true,
      uasFlag: true,
      loitering: true,
      highAltitude: true,
      missingRID: true,
      repeatSighting: true,
      nearMannedCorridor: true,
    },
  },
  {
    id: 2,
    name: 'Łódź Industrial Flyover',
    lat: 51.7592,
    lon: 19.455,
    riskFactors: {
      imeiModem: true,
      dataOnly: false,
      highSpeed: true,
      highHandover: true,
      verticalMovement: true,
      inNoFlyZone: false,
      uasFlag: true,
      loitering: false,
      highAltitude: true,
      missingRID: true,
      repeatSighting: false,
      nearMannedCorridor: true,
    },
  },
  {
    id: 3,
    name: 'Gdańsk Port Surveyor',
    lat: 54.352,
    lon: 18.6466,
    riskFactors: {
      imeiModem: true,
      dataOnly: true,
      highSpeed: false,
      highHandover: false,
      verticalMovement: true,
      inNoFlyZone: true,
      uasFlag: true,
      loitering: true,
      highAltitude: false,
      missingRID: false,
      repeatSighting: true,
      nearMannedCorridor: false,
    },
  },
  {
    id: 4,
    name: 'Poznań Delivery Route',
    lat: 52.4064,
    lon: 16.9252,
    riskFactors: {
      imeiModem: false,
      dataOnly: false,
      highSpeed: false,
      highHandover: false,
      verticalMovement: false,
      inNoFlyZone: false,
      uasFlag: true,
      loitering: false,
      highAltitude: false,
      missingRID: false,
      repeatSighting: true,
      nearMannedCorridor: false,
    },
  },
  {
    id: 5,
    name: 'Kraków Tourist Flight',
    lat: 50.0647,
    lon: 19.945,
    riskFactors: {
      imeiModem: false,
      dataOnly: false,
      highSpeed: false,
      highHandover: false,
      verticalMovement: false,
      inNoFlyZone: false,
      uasFlag: false,
      loitering: false,
      highAltitude: false,
      missingRID: false,
      repeatSighting: false,
      nearMannedCorridor: false,
    },
  },
  {
    id: 6,
    name: 'Rzeszów Border Patrol',
    lat: 50.0412,
    lon: 21.9991,
    riskFactors: {
      imeiModem: false,
      dataOnly: true,
      highSpeed: true,
      highHandover: false,
      verticalMovement: true,
      inNoFlyZone: true,
      uasFlag: true,
      loitering: true,
      highAltitude: true,
      missingRID: true,
      repeatSighting: true,
      nearMannedCorridor: false,
    },
  },
];

const calculateRiskProfile = (riskFactors) => {
  const flags = Object.values(riskFactors);
  const positiveFlags = flags.filter(Boolean).length;
  const riskScore = Math.round((positiveFlags / flags.length) * 100);

  let riskLevel = 'Low';
  if (riskScore >= 70) {
    riskLevel = 'High';
  } else if (riskScore >= 40) {
    riskLevel = 'Medium';
  }

  return { riskScore, riskLevel };
};

function App() {
  const polandCenter = [52.0976, 19.1451];
  const polandZoom = 6;
  const polandBounds = [
    [48.9965, 14.1229],
    [54.8356, 24.1458],
  ];

  const targets = rawTargets.map((target) => ({
    ...target,
    ...calculateRiskProfile(target.riskFactors),
  }));

  return (
    <div className="app">
      <header className="app-header">
        <h1>Drone Risk Dashboard</h1>
      </header>
      <div className="app-body">
        <aside className="sidebar" aria-label="Target list">
          <h2>Targets</h2>
          <ul>
            {targets.map((target) => (
              <li key={target.id}>
                <strong>{target.name}</strong> — {target.riskLevel} Risk (Score: {target.riskScore})
              </li>
            ))}
          </ul>
        </aside>
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
