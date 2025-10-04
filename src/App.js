import { Fragment, useState } from 'react';
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
      [54.728, 20.363],
      [54.714, 20.438],
      [54.7065, 20.475],
      [54.699, 20.51],
      [54.69, 20.545],
      [54.6805, 20.58],
      [54.67, 20.615],
      [54.6575, 20.648],
      [54.643, 20.679],
      [54.6265, 20.708],
      [54.608, 20.735],
      [54.588, 20.76],
      [54.5665, 20.783],
      [54.543, 20.802],
      [54.518, 20.815],
      [54.492, 20.822],
      [54.4645, 20.821],
      [54.436, 20.811],
      [54.4075, 20.792],
      [54.379, 20.765],
      [54.3505, 20.732],
      [54.323, 20.693],
      [54.2965, 20.649],
      [54.271, 20.602],
      [54.2465, 20.551],
      [54.224, 20.497],
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
      [53.945, 24.02],
      [53.918, 23.965],
      [53.894, 23.914],
      [53.872, 23.867],
      [53.851, 23.825],
      [53.832, 23.788],
      [53.814, 23.754],
      [53.796, 23.72],
      [53.777, 23.688],
      [53.757, 23.656],
      [53.735, 23.624],
      [53.711, 23.592],
      [53.686, 23.56],
      [53.659, 23.528],
      [53.631, 23.497],
      [53.601, 23.466],
      [53.569, 23.436],
      [53.535, 23.406],
      [53.499, 23.376],
      [53.461, 23.346],
      [53.421, 23.316],
      [53.379, 23.286],
      [53.335, 23.256],
      [53.289, 23.226],
      [53.241, 23.196],
      [53.191, 23.166],
      [53.139, 23.136],
      [53.085, 23.106],
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
      [49.92, 23.85],
      [49.94, 23.804],
      [49.957, 23.76],
      [49.973, 23.717],
      [49.988, 23.674],
      [50.002, 23.631],
      [50.015, 23.588],
      [50.028, 23.545],
      [50.04, 23.502],
      [50.052, 23.459],
      [50.063, 23.416],
      [50.074, 23.373],
      [50.085, 23.33],
      [50.096, 23.287],
      [50.107, 23.244],
      [50.118, 23.201],
      [50.129, 23.158],
      [50.14, 23.115],
      [50.151, 23.072],
      [50.162, 23.029],
      [50.173, 22.986],
      [50.184, 22.943],
      [50.195, 22.9],
      [50.206, 22.857],
      [50.217, 22.814],
      [50.228, 22.771],
      [50.239, 22.728],
      [50.25, 22.685],
      [50.261, 22.642],
      [50.272, 22.599],
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
      [48.715, 21.25],
      [48.805, 21.22],
      [48.895, 21.2],
      [48.985, 21.185],
      [49.065, 21.245],
      [49.145, 21.305],
      [49.225, 21.365],
      [49.305, 21.425],
      [49.385, 21.485],
      [49.465, 21.545],
      [49.545, 21.605],
      [49.625, 21.665],
      [49.705, 21.725],
      [49.785, 21.785],
      [49.865, 21.845],
      [49.945, 21.905],
      [50.025, 21.965],
      [50.105, 22.025],
      [50.185, 22.085],
      [50.265, 22.145],
      [50.345, 22.205],
      [50.425, 22.265],
      [50.505, 22.325],
      [50.585, 22.385],
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
      [49.05, 18.73],
      [49.11, 18.79],
      [49.17, 18.85],
      [49.23, 18.91],
      [49.29, 18.97],
      [49.35, 19.03],
      [49.41, 19.09],
      [49.47, 19.15],
      [49.53, 19.21],
      [49.59, 19.27],
      [49.65, 19.33],
      [49.71, 19.39],
      [49.77, 19.45],
      [49.83, 19.51],
      [49.89, 19.57],
      [49.95, 19.63],
      [50.01, 19.69],
      [50.07, 19.75],
      [50.13, 19.81],
      [50.19, 19.87],
      [50.25, 19.93],
      [50.31, 19.99],
      [50.37, 20.05],
      [50.43, 20.11],
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
      [52.7, 24.0],
      [52.66, 23.92],
      [52.62, 23.84],
      [52.58, 23.76],
      [52.54, 23.68],
      [52.5, 23.6],
      [52.46, 23.52],
      [52.42, 23.44],
      [52.38, 23.36],
      [52.34, 23.28],
      [52.3, 23.2],
      [52.26, 23.12],
      [52.22, 23.04],
      [52.18, 22.96],
      [52.14, 22.88],
      [52.1, 22.8],
      [52.06, 22.72],
      [52.02, 22.64],
      [51.98, 22.56],
      [51.94, 22.48],
      [51.9, 22.4],
      [51.86, 22.32],
      [51.82, 22.24],
      [51.78, 22.16],
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

const riskWeights = {
  imeiModem: 10,
  dataOnly: 5,
  highSpeed: 5,
  highHandover: 5,
  verticalMovement: 5,
  inNoFlyZone: 30,
  uasFlag: 10,
  loitering: 5,
  highAltitude: 5,
  missingRID: 15,
  repeatSighting: 5,
  nearMannedCorridor: 10,
};

const riskFactorDetails = {
  imeiModem: 'IMEI indicates IoT module',
  dataOnly: 'Telemetry-only traffic',
  highSpeed: 'High speed detected',
  highHandover: 'Frequent cell handovers',
  verticalMovement: 'Significant vertical movement',
  inNoFlyZone: 'No-Fly-Zone violation',
  uasFlag: 'UAS flag present',
  loitering: 'Loitering behaviour detected',
  highAltitude: 'High altitude flight',
  missingRID: 'Remote ID missing',
  repeatSighting: 'Repeat sighting recorded',
  nearMannedCorridor: 'Near manned air corridor',
};

const computeRisk = (riskFactors) => {
  const riskScore = Object.entries(riskWeights).reduce(
    (score, [factor, weight]) => (riskFactors[factor] ? score + weight : score),
    0,
  );

  let riskLevel = 'Low';
  if (riskScore >= 50) {
    riskLevel = 'High';
  } else if (riskScore >= 20) {
    riskLevel = 'Medium';
  }

  return { riskScore, riskLevel };
};

function App() {
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const polandCenter = [52.0976, 19.1451];
  const polandZoom = 6.5;
  const mapMinZoom = 5.5;
  const mapMaxZoom = 20;
  const regionalBounds = [
    [47.0, 11.0],
    [56.0, 27.0],
  ];

  const targets = rawTargets.map((target, index) => ({
    ...computeRisk(target.riskFactors),
    callSign: `Drone-${String(index + 1).padStart(3, '0')}`,
    id: target.id,
    track: target.track,
    startPosition: target.track[0],
    endPosition: target.track[target.track.length - 1],
    riskFactors: target.riskFactors,
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
                <div className="target-content">
                  <div className="target-header">
                    <strong>{target.callSign}</strong>
                    <button
                      type="button"
                      className="details-button"
                      onClick={() =>
                        setSelectedTargetId((current) =>
                          current === target.id ? null : target.id,
                        )
                      }
                      aria-expanded={selectedTargetId === target.id}
                    >
                      Details
                    </button>
                  </div>
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
                  {selectedTargetId === target.id && (
                    <ul className="factor-breakdown">
                      {Object.entries(riskWeights).map(([factor, weight]) => {
                        const triggered = target.riskFactors[factor];
                        const points = triggered ? weight : 0;
                        return (
                          <li key={factor}>
                            <span className="factor-label">{riskFactorDetails[factor]}</span>
                            <span className="factor-result">
                              {triggered ? 'Yes' : 'No'}
                              <span className="factor-points">{` (+${points})`}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <main className="map-wrapper" aria-label="Map display">
          <MapContainer
            center={polandCenter}
            zoom={polandZoom}
            minZoom={mapMinZoom}
            maxZoom={mapMaxZoom}
            zoomSnap={0.5}
            maxBounds={regionalBounds}
            maxBoundsViscosity={1}
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
