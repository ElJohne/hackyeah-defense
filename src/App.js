import { Fragment } from 'react';
import { MapContainer, TileLayer, Popup, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const riskColors = {
  Low: '#2f9e44',
  Medium: '#f08c00',
  High: '#c92a2a',
};

const trajectoryOptions = {
  weight: 4,
  opacity: 0.85,
  dashArray: '6 8',
  lineCap: 'round',
};

const rawTargets = [
  {
    id: 1,
    track: [
      [52.2174, 20.9452],
      [52.2199, 20.967],
      [52.2231, 20.9894],
      [52.2274, 21.0026],
      [52.231, 21.0178],
    ],
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
    track: [
      [51.7387, 19.3578],
      [51.7459, 19.3846],
      [51.7506, 19.4122],
      [51.7558, 19.4367],
      [51.7622, 19.4613],
    ],
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
    track: [
      [54.3211, 18.5247],
      [54.3279, 18.5521],
      [54.3358, 18.5811],
      [54.3436, 18.6084],
      [54.3517, 18.6429],
    ],
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
    track: [
      [52.3615, 16.8423],
      [52.3731, 16.8647],
      [52.3863, 16.8932],
      [52.3978, 16.9156],
      [52.4084, 16.9389],
    ],
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
    track: [
      [50.0327, 19.8765],
      [50.0398, 19.8971],
      [50.0475, 19.9196],
      [50.0551, 19.9373],
      [50.0629, 19.9564],
    ],
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
    track: [
      [50.0063, 21.9058],
      [50.0131, 21.9287],
      [50.0214, 21.9528],
      [50.0312, 21.9779],
      [50.0418, 22.0034],
    ],
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

  const targets = rawTargets.map((target, index) => ({
    ...calculateRiskProfile(target.riskFactors),
    callSign: `Drone-${String(index + 1).padStart(3, '0')}`,
    id: target.id,
    track: target.track,
    startPosition: target.track[0],
    endPosition: target.track[target.track.length - 1],
  }));

  const startMarkerOptions = {
    radius: 6,
    weight: 2,
    color: '#1f2933',
    fillColor: '#ffffff',
    fillOpacity: 1,
  };

  const createEndMarkerOptions = (riskLevel) => ({
    radius: 7,
    weight: 2,
    color: '#ffffff',
    fillColor: riskColors[riskLevel],
    fillOpacity: 1,
  });

  const formatCoordinate = ([lat, lon]) => `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Drone Risk Dashboard</h1>
      </header>
      <div className="app-body">
        <aside className="sidebar" aria-label="Target list">
          <h2>Targets</h2>
          <ul className="target-list">
            {targets.map((target) => (
              <li key={target.id}>
                <span
                  className="risk-indicator"
                  style={{ backgroundColor: riskColors[target.riskLevel] }}
                  aria-hidden
                />
                <div>
                  <strong>{target.callSign}</strong>
                  <dl className="target-meta">
                    <div>
                      <dt>Risk</dt>
                      <dd>
                        {target.riskLevel} · Score {target.riskScore}
                      </dd>
                    </div>
                    <div>
                      <dt>Start</dt>
                      <dd>{formatCoordinate(target.startPosition)}</dd>
                    </div>
                    <div>
                      <dt>Last seen</dt>
                      <dd>{formatCoordinate(target.endPosition)}</dd>
                    </div>
                  </dl>
                </div>
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
            {targets.map((target) => (
              <Fragment key={target.id}>
                <Polyline
                  positions={target.track}
                  pathOptions={{
                    ...trajectoryOptions,
                    color: riskColors[target.riskLevel],
                  }}
                />
                <CircleMarker center={target.startPosition} pathOptions={startMarkerOptions}>
                  <Popup>
                    <strong>{target.callSign}</strong>
                    <br />
                    Launch position: {formatCoordinate(target.startPosition)}
                  </Popup>
                </CircleMarker>
                <CircleMarker
                  center={target.endPosition}
                  pathOptions={createEndMarkerOptions(target.riskLevel)}
                >
                  <Popup>
                    <strong>{target.callSign}</strong>
                    <br />
                    Current position: {formatCoordinate(target.endPosition)}
                    <br />
                    Risk: {target.riskLevel} ({target.riskScore})
                  </Popup>
                </CircleMarker>
              </Fragment>
            ))}
          </MapContainer>
          <div className="map-legend" aria-label="Risk legend">
            <h3>Risk Legend</h3>
            <ul>
              {Object.entries(riskColors).map(([level, color]) => (
                <li key={level}>
                  <span className="legend-swatch" style={{ backgroundColor: color }} aria-hidden />
                  {level}
                </li>
              ))}
            </ul>
            <div className="legend-footnote">
              <span className="legend-entry">
                <span className="legend-start" aria-hidden />
                Launch position
              </span>
              <span className="legend-entry">
                <span className="legend-end" aria-hidden />
                Current position
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
