import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Popup,
  Polyline,
  CircleMarker,
  Circle,
  Marker,
  Tooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import droneImage from './assets/drone.svg';

const riskColors = {
  Low: '#2f9e44',
  Medium: '#f08c00',
  High: '#c92a2a',
};
const riskLevels = Object.keys(riskColors);

const trajectoryOptions = {
  weight: 4,
  opacity: 0.85,
  dashArray: '6 8',
  lineCap: 'round',
};

const mitigationColor = '#2563eb';

const radioCoverageRadiusMeters = 30000;
const radioCoverageStyle = {
  color: '#1d4ed8',
  weight: 1.2,
  dashArray: '6 10',
  fillColor: '#3b82f6',
  fillOpacity: 0.1,
};

const radioStations = [
  {
    id: 'szczecin',
    name: 'Szczecin Mobile Intercept Node',
    position: [53.4285, 14.5528],
  },
  {
    id: 'zielona-gora',
    name: 'Zielona Góra Mobile Intercept Node',
    position: [51.9356, 15.5062],
  },
  {
    id: 'poznan',
    name: 'Poznań Mobile Intercept Node',
    position: [52.4064, 16.9252],
  },
  {
    id: 'bydgoszcz',
    name: 'Bydgoszcz Mobile Intercept Node',
    position: [53.1235, 18.0084],
  },
  {
    id: 'gdansk',
    name: 'Gdańsk Mobile Intercept Node',
    position: [54.352, 18.6466],
  },
  {
    id: 'olsztyn',
    name: 'Olsztyn Mobile Intercept Node',
    position: [53.7784, 20.4801],
  },
  {
    id: 'warsaw',
    name: 'Warsaw Mobile Intercept Node',
    position: [52.2297, 21.0122],
  },
  {
    id: 'lodz',
    name: 'Łódź Mobile Intercept Node',
    position: [51.7592, 19.455],
  },
  {
    id: 'lublin',
    name: 'Lublin Mobile Intercept Node',
    position: [51.2465, 22.5684],
  },
  {
    id: 'rzeszow',
    name: 'Rzeszów Mobile Intercept Node',
    position: [50.0412, 21.9991],
  },
  {
    id: 'krakow',
    name: 'Kraków Mobile Intercept Node',
    position: [50.0647, 19.945],
  },
  {
    id: 'katowice',
    name: 'Katowice Mobile Intercept Node',
    position: [50.2709, 19.039],
  },
  {
    id: 'wroclaw',
    name: 'Wrocław Mobile Intercept Node',
    position: [51.1079, 17.0385],
  },
  {
    id: 'bialystok',
    name: 'Białystok Mobile Intercept Node',
    position: [53.1325, 23.1688],
  },
  {
    id: 'suwalki',
    name: 'Suwałki Mobile Intercept Node',
    position: [54.1117, 22.9302],
  },
];

const toRadians = (value) => (value * Math.PI) / 180;
const toDegrees = (value) => (value * 180) / Math.PI;
const EARTH_RADIUS_METERS = 6371000;

const computeDistanceMeters = ([lat1, lon1], [lat2, lon2]) => {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

const computeHeading = (track) => {
  if (!track || track.length < 2) {
    return 0;
  }

  const [lat1, lon1] = track[track.length - 2];
  const [lat2, lon2] = track[track.length - 1];

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;
  return bearing;
};

const actionDefinitions = {
  simDetach: {
    label: 'SIM Detach',
    successOutcome: 'allowed',
    successMessage: 'Cellular C2 suspected; session detached.',
    errorOutcome: 'no-effect',
    errorMessage: 'No cellular control detected (likely RF/LOS).',
    buttonClass: 'action-button action-button--blue',
  },
  cyberTakeover: {
    label: 'Cyber Takeover',
    successOutcome: 'allowed',
    successMessage: 'Compatible C2 link; sterile LZ available.',
    errorOutcome: 'failed',
    errorMessage: 'No compatible C2 link discovered (unknown/encrypted).',
    buttonClass: 'action-button action-button--blue',
  },
  directionalJam: {
    label: 'Directional Jam',
    successOutcome: 'allowed',
    successMessage: 'Interlocks passed (ADS-B/GNSS corridor).',
    errorOutcome: 'blocked',
    errorMessage: 'ADS-B conflict — manned aircraft in vicinity.',
    buttonClass: 'action-button action-button--red',
  },
  report: {
    label: 'Report',
    successOutcome: 'reported',
    successMessage: 'After-action report submitted to command.',
    errorOutcome: 'failed',
    errorMessage: 'Report uplink unavailable — retry later.',
    buttonClass: 'action-button action-button--green',
  },
};

const actionFeedbackDuration = 3000;

const rawTargets = [
  {
    id: 1,
    track: [
      [54.728, 20.363],
      [54.714, 20.41],
      [54.701, 20.47],
      [54.688, 20.54],
      [54.675, 20.6],
      [54.66, 20.66],
      [54.642, 20.71],
      [54.62, 20.75],
      [54.594, 20.77],
      [54.564, 20.76],
      [54.533, 20.74],
      [54.504, 20.73],
      [54.476, 20.75],
      [54.448, 20.8],
      [54.422, 20.86],
      [54.399, 20.93],
      [54.379, 21.0],
      [54.359, 21.06],
      [54.336, 21.11],
      [54.309, 21.15],
      [54.278, 21.17],
      [54.245, 21.18],
      [54.212, 21.19],
      [54.179, 21.21],
      [54.146, 21.25],
      [54.114, 21.3],
      [54.082, 21.35],
      [54.049, 21.39],
      [54.015, 21.41],
      [53.98, 21.4],
      [53.944, 21.37],
      [53.908, 21.33],
      [53.872, 21.29],
      [53.836, 21.25],
      [53.801, 21.22],
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
      noSpeedChangeWaterLand: true,
    },
    actionOutcomes: {
      simDetach: 'allowed',
      cyberTakeover: 'failed',
      directionalJam: 'allowed',
      report: 'reported',
    },
  },
  {
    id: 2,
    track: [
      [53.945, 24.02],
      [53.922, 23.99],
      [53.9, 23.95],
      [53.88, 23.9],
      [53.863, 23.85],
      [53.847, 23.79],
      [53.833, 23.73],
      [53.82, 23.68],
      [53.804, 23.64],
      [53.785, 23.61],
      [53.762, 23.59],
      [53.737, 23.59],
      [53.711, 23.61],
      [53.684, 23.64],
      [53.656, 23.67],
      [53.628, 23.7],
      [53.599, 23.71],
      [53.569, 23.7],
      [53.54, 23.67],
      [53.512, 23.63],
      [53.482, 23.59],
      [53.452, 23.56],
      [53.419, 23.54],
      [53.382, 23.54],
      [53.345, 23.55],
      [53.309, 23.56],
      [53.272, 23.55],
      [53.234, 23.51],
      [53.195, 23.45],
      [53.155, 23.38],
      [53.114, 23.32],
      [53.072, 23.27],
      [53.03, 23.24],
      [52.987, 23.23],
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
      noSpeedChangeWaterLand: false,
    },
    actionOutcomes: {
      simDetach: 'no-effect',
      cyberTakeover: 'allowed',
      directionalJam: 'blocked',
      report: 'reported',
    },
  },
  {
    id: 3,
    track: [
      [49.92, 23.85],
      [49.94, 23.81],
      [49.96, 23.77],
      [49.98, 23.73],
      [50.0, 23.69],
      [50.022, 23.66],
      [50.046, 23.64],
      [50.071, 23.63],
      [50.098, 23.66],
      [50.126, 23.7],
      [50.155, 23.74],
      [50.185, 23.77],
      [50.215, 23.78],
      [50.245, 23.77],
      [50.275, 23.74],
      [50.305, 23.7],
      [50.334, 23.65],
      [50.363, 23.6],
      [50.392, 23.57],
      [50.421, 23.56],
      [50.451, 23.58],
      [50.48, 23.62],
      [50.51, 23.66],
      [50.54, 23.69],
      [50.57, 23.69],
      [50.601, 23.66],
      [50.632, 23.61],
      [50.663, 23.55],
      [50.694, 23.5],
      [50.725, 23.46],
      [50.756, 23.42],
      [50.787, 23.38],
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
      noSpeedChangeWaterLand: false,
    },
    actionOutcomes: {
      simDetach: 'allowed',
      cyberTakeover: 'allowed',
      directionalJam: 'allowed',
      report: 'reported',
    },
  },
  {
    id: 4,
    track: [
      [48.715, 21.25],
      [48.742, 21.273],
      [48.775, 21.3],
      [48.81, 21.33],
      [48.845, 21.36],
      [48.878, 21.4],
      [48.91, 21.44],
      [48.945, 21.49],
      [48.982, 21.53],
      [49.02, 21.56],
      [49.06, 21.58],
      [49.102, 21.6],
      [49.147, 21.62],
      [49.193, 21.65],
      [49.237, 21.69],
      [49.278, 21.74],
      [49.318, 21.8],
      [49.356, 21.86],
      [49.392, 21.92],
      [49.428, 21.98],
      [49.465, 22.04],
      [49.503, 22.09],
      [49.545, 22.13],
      [49.59, 22.17],
      [49.638, 22.21],
      [49.688, 22.25],
      [49.739, 22.29],
      [49.79, 22.33],
      [49.84, 22.36],
      [49.888, 22.39],
      [49.934, 22.42],
      [49.98, 22.45],
      [50.026, 22.48],
      [50.071, 22.51],
      [50.116, 22.54],
      [50.159, 22.57],
      [50.2, 22.6],
      [50.24, 22.64],
      [50.28, 22.68],
      [50.32, 22.72],
      [50.36, 22.76],
      [50.4, 22.8],
      [50.44, 22.84],
      [50.48, 22.88],
      [50.52, 22.92],
      [50.56, 22.96],
      [50.6, 23.0],
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
      noSpeedChangeWaterLand: false,
    },
    actionOutcomes: {
      simDetach: 'no-effect',
      cyberTakeover: 'failed',
      directionalJam: 'blocked',
      report: 'reported',
    },
  },
  {
    id: 5,
    track: [
      [49.23, 18.73],
      [49.35, 18.81],
      [49.48, 18.78],
      [49.56, 19.07],
      [49.63, 19.16],
      [49.78, 19.07],
      [49.84, 19.09],
      [49.85, 19.34],
      [49.88, 19.48]
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
      noSpeedChangeWaterLand: true,
    },
    actionOutcomes: {
      simDetach: 'no-effect',
      cyberTakeover: 'failed',
      directionalJam: 'blocked',
      report: 'reported',
    },
  },
  {
    id: 6,
    track: [
      [52.7, 24.0],
      [52.67, 23.95],
      [52.64, 23.9],
      [52.61, 23.84],
      [52.58, 23.78],
      [52.55, 23.72],
      [52.52, 23.67],
      [52.49, 23.62],
      [52.46, 23.57],
      [52.43, 23.53],
      [52.4, 23.49],
      [52.36, 23.46],
      [52.32, 23.44],
      [52.28, 23.43],
      [52.24, 23.43],
      [52.2, 23.44],
      [52.16, 23.46],
      [52.12, 23.49],
      [52.08, 23.52],
      [52.04, 23.55],
      [52.0, 23.57],
      [51.96, 23.56],
      [51.92, 23.52],
      [51.88, 23.45],
      [51.84, 23.37],
      [51.8, 23.28],
      [51.76, 23.18],
      [51.72, 23.07],
      [51.68, 22.96],
      [51.64, 22.85],
      [51.6, 22.75],
      [51.56, 22.66],
      [51.52, 22.58],
      [51.48, 22.52],
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
      noSpeedChangeWaterLand: true,
    },
    actionOutcomes: {
      simDetach: 'allowed',
      cyberTakeover: 'failed',
      directionalJam: 'allowed',
      report: 'reported',
    },
  },
  {
    id: 7,
    track: [
      [55.3, 18.2],
      [55.24, 18.25],
      [55.19, 18.32],
      [55.14, 18.4],
      [55.09, 18.5],
      [55.05, 18.62],
      [55.0, 18.74],
      [54.95, 18.86],
      [54.9, 18.98],
      [54.85, 19.1],
      [54.8, 19.22],
      [54.75, 19.34],
      [54.7, 19.46],
      [54.65, 19.58],
      [54.6, 19.7],
      [54.55, 19.82],
      [54.5, 19.94],
      [54.45, 20.05],
      [54.4, 20.16],
      [54.35, 20.27],
    ],
    riskFactors: {
      imeiModem: true,
      dataOnly: true,
      highSpeed: false,
      highHandover: true,
      verticalMovement: true,
      inNoFlyZone: false,
      uasFlag: true,
      loitering: false,
      highAltitude: true,
      missingRID: true,
      repeatSighting: false,
      nearMannedCorridor: true,
      noSpeedChangeWaterLand: true,
    },
    actionOutcomes: {
      simDetach: 'blocked',
      cyberTakeover: 'allowed',
      directionalJam: 'allowed',
      report: 'reported',
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
  noSpeedChangeWaterLand: 20,
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
  noSpeedChangeWaterLand: 'Consistent speed transitioning water ↔ land',
};

const riskFactorDescriptions = {
  imeiModem:
    'The cellular signature aligns with an IoT modem, which is typical for remote-control telemetry rather than a consumer handset.',
  dataOnly:
    'The SIM communicates using data-only service, pointing to a command-and-control link without normal voice or SMS activity.',
  highSpeed:
    'Ground track shows sustained high velocity, increasing the likelihood of a powered unmanned aircraft.',
  highHandover:
    'The device is rapidly roaming between cells, matching an airborne platform traversing multiple sectors.',
  verticalMovement:
    'Cell measurements indicate notable altitude changes, suggesting significant climb or descent.',
  inNoFlyZone:
    'The trajectory intersects a restricted or prohibited airspace where drone operations are not authorised.',
  uasFlag:
    'Network metadata already tags this subscriber as an unmanned aerial system asset.',
  loitering:
    'Movement pattern reveals dwell or circular loitering behaviour, often tied to surveillance missions.',
  highAltitude:
    'Reported altitude exceeds the expected range for hobbyist drones, elevating risk to other airspace users.',
  missingRID:
    'No Remote ID broadcast is detected, violating identification requirements and obscuring accountability.',
  repeatSighting:
    'This device has been observed in prior incidents, indicating persistent or deliberate activity.',
  nearMannedCorridor:
    'Flight path is close to established manned-aviation corridors, heightening collision hazards.',
  noSpeedChangeWaterLand:
    'Speed remains constant while transitioning between water and land sectors, signalling autonomous guidance.',
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
  const [detailsTargetId, setDetailsTargetId] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionResults, setActionResults] = useState({});
  const [visibleActionTooltips, setVisibleActionTooltips] = useState({});
  const [mitigatedTargets, setMitigatedTargets] = useState({});
  const [actionLog, setActionLog] = useState([]);
  const [riskFilters, setRiskFilters] = useState([]);
  const [showRadioStations, setShowRadioStations] = useState(true);
  const [notifyingStations, setNotifyingStations] = useState(() => new Set());
  const [activeStationId, setActiveStationId] = useState(null);
  const [usedActions, setUsedActions] = useState({});
  const [targetOrder, setTargetOrder] = useState(() => rawTargets.map((target) => target.id));
  const listRefs = useRef({});
  const trajectoryRefs = useRef({});
  const startMarkerRefs = useRef({});
  const endMarkerRefs = useRef({});
  const actionTooltipTimersRef = useRef({});
  const droneIconCacheRef = useRef({});
  const mapRef = useRef(null);
  const notificationTimers = useRef({});
  const stationPanelDismissTimerRef = useRef(null);
  const polandCenter = [52.0976, 19.1451];
  const polandZoom = 6.5;
  const mapMinZoom = 5.5;
  const mapMaxZoom = 20;
  const regionalBounds = [
    [47.0, 11.0],
    [56.0, 27.0],
  ];

  const radioStationIcon = useMemo(
    () =>
      L.divIcon({
        className: 'radio-station-icon',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -24],
        html: `
          <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mobile interception station">
            <circle cx="24" cy="24" r="22" fill="rgba(37, 99, 235, 0.12)" />
            <circle cx="24" cy="24" r="14" fill="rgba(37, 99, 235, 0.35)" />
            <circle cx="24" cy="24" r="6" fill="#1d4ed8" />
            <path d="M24 10v8M24 30v8M10 24h8M30 24h8" stroke="#1d4ed8" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        `,
      }),
    [],
  );

  const radioNotificationIcon = useMemo(
    () =>
      L.divIcon({
        className: 'radio-notify-marker',
        iconSize: [96, 96],
        iconAnchor: [48, 48],
        html: `
          <span class="radio-notify__pulse"></span>
          <span class="radio-notify__pulse radio-notify__pulse--delay"></span>
        `,
      }),
    [],
  );

  const targets = useMemo(
    () =>
      rawTargets.map((target, index) => {
        const riskFactors = {
          ...target.riskFactors,
        };

        if (riskFactors.noSpeedChangeWaterLand === undefined) {
          riskFactors.noSpeedChangeWaterLand = false;
        }

        return {
          ...computeRisk(riskFactors),
          callSign: `Drone-${String(index + 1).padStart(3, '0')}`,
          id: target.id,
          track: target.track,
          startPosition: target.track[0],
          endPosition: target.track[target.track.length - 1],
          heading: computeHeading(target.track),
          riskFactors,
          actionOutcomes: target.actionOutcomes,
        };
      }),
    [],
  );

  const toggleRiskFilter = useCallback((level) => {
    setRiskFilters((prev) => {
      const isActive = prev.includes(level);
      let nextFilters;

      if (isActive) {
        nextFilters = prev.filter((item) => item !== level);
      } else {
        nextFilters = [...prev, level];
      }

      if (!isActive && nextFilters.length === riskLevels.length) {
        return [];
      }

      const nextSet = new Set(nextFilters);
      return riskLevels.filter((item) => nextSet.has(item));
    });
  }, []);

  const handleNotifyStation = useCallback((stationId, { dismissPanel = false } = {}) => {
    setNotifyingStations((prev) => {
      const next = new Set(prev);
      next.add(stationId);
      return next;
    });

    if (notificationTimers.current[stationId]) {
      clearTimeout(notificationTimers.current[stationId]);
    }

    notificationTimers.current[stationId] = setTimeout(() => {
      setNotifyingStations((prev) => {
        const next = new Set(prev);
        next.delete(stationId);
        return next;
      });

      delete notificationTimers.current[stationId];
    }, 2400);

    if (dismissPanel) {
      if (stationPanelDismissTimerRef.current) {
        clearTimeout(stationPanelDismissTimerRef.current);
      }

      stationPanelDismissTimerRef.current = setTimeout(() => {
        setActiveStationId((currentId) => (currentId === stationId ? null : currentId));
        stationPanelDismissTimerRef.current = null;
      }, 1000);
    }
  }, []);

  useEffect(() => {
    const timersRef = notificationTimers.current;

    return () => {
      Object.values(timersRef).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });

      if (stationPanelDismissTimerRef.current) {
        clearTimeout(stationPanelDismissTimerRef.current);
      }
    };
  }, [notificationTimers]);

  const toggleRadioStations = useCallback(() => {
    setShowRadioStations((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!showRadioStations) {
      if (stationPanelDismissTimerRef.current) {
        clearTimeout(stationPanelDismissTimerRef.current);
        stationPanelDismissTimerRef.current = null;
      }

      setActiveStationId(null);
    }
  }, [showRadioStations]);
  const orderedTargets = useMemo(() => {
    const targetMap = new Map(targets.map((target) => [target.id, target]));
    return targetOrder.map((id) => targetMap.get(id)).filter(Boolean);
  }, [targetOrder, targets]);

  const filteredTargets = useMemo(
    () =>
      riskFilters.length === 0
        ? orderedTargets
        : orderedTargets.filter((target) => riskFilters.includes(target.riskLevel)),
    [orderedTargets, riskFilters],
  );

  const engagedStations = useMemo(() => {
    const engaged = new Set();
    // const covered = new Set();

    targets.forEach((target) => {
      radioStations.forEach((station) => {
        const distance = computeDistanceMeters(station.position, target.endPosition);

        if (distance <= radioCoverageRadiusMeters) {
          engaged.add(station.id);
          // return true;
        }

        // return false;
      });

      // if (isCovered) {
      //   covered.add(target.id);
      // }
    });

    return engaged; //{ engagedStations: engaged, coveredTargets: covered };
  }, [targets]);

  const activeStation = useMemo(() => {
    if (!activeStationId) {
      return null;
    }

    return radioStations.find((station) => station.id === activeStationId) ?? null;
  }, [activeStationId]);
  const handleStationSelect = useCallback((stationId) => {
    if (stationPanelDismissTimerRef.current) {
      clearTimeout(stationPanelDismissTimerRef.current);
      stationPanelDismissTimerRef.current = null;
    }

    setActiveStationId(stationId);
  }, []);
  const handleStationPanelClose = useCallback(() => {
    if (stationPanelDismissTimerRef.current) {
      clearTimeout(stationPanelDismissTimerRef.current);
      stationPanelDismissTimerRef.current = null;
    }

    setActiveStationId(null);
  }, []);
  const activeStationIsEngaged = activeStation
    ? engagedStations.has(activeStation.id)
    : false;
  const totalActionCount = useMemo(() => Object.keys(actionDefinitions).length, []);

  const getDroneIcon = useCallback((riskLevel, heading) => {
    const normalizedHeading = Math.round(heading);
    const cacheKey = `${riskLevel}-${normalizedHeading}`;

    if (!droneIconCacheRef.current[cacheKey]) {
      droneIconCacheRef.current[cacheKey] = L.divIcon({
        className: '',
        html: `
          <div class="drone-end-marker" style="background:${riskColors[riskLevel]}">
            <img
              src="${droneImage}"
              alt=""
              role="presentation"
              class="drone-end-marker__image"
              style="transform: rotate(${normalizedHeading}deg);"
            />
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -24],
        tooltipAnchor: [0, -28],
      });
    }

    return droneIconCacheRef.current[cacheKey];
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = setTimeout(() => setToast(null), actionFeedbackDuration);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      Object.values(actionTooltipTimersRef.current).forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDetailsTargetId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startMarkerOptions = {
    radius: 6,
    weight: 2,
    color: '#1f2933',
    fillColor: '#ffffff',
    fillOpacity: 1,
    className: 'drone-marker',
  };

  const formatCoordinate = useCallback(
    ([lat, lon]) => `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    []
  );

  const legendItems = [
    ...Object.entries(riskColors).map(([level, color]) => ({
      key: level,
      label: `${level} risk`,
      color,
    })),
    {
      key: 'Mitigated',
      label: 'Mitigated trajectory',
      color: mitigationColor,
    },
  ];

  const auditSummary = useMemo(() => {
    const engagedTargets = new Set();
    const successfulTargets = new Set();
    const reportedTargets = new Set();

    actionLog.forEach((entry) => {
      engagedTargets.add(entry.targetId);
      if (entry.countsAsSuccess) {
        successfulTargets.add(entry.targetId);
      }
      if (entry.reported) {
        reportedTargets.add(entry.targetId);
      }
    });

    const unsuccessfulTargets = new Set(
      Array.from(engagedTargets).filter((targetId) => !successfulTargets.has(targetId)),
    );

    return {
      totalTargets: targets.length,
      engagedTargets: engagedTargets.size,
      successfulTargets: successfulTargets.size,
      unsuccessfulTargets: unsuccessfulTargets.size,
      reportedTargets: reportedTargets.size,
    };
  }, [actionLog, targets]);

  const handleDownloadLog = useCallback(() => {
    const now = new Date();
    const timestamp = now.toISOString();

    const lines = [
      'Drone Response Audit Log',
      `Generated: ${timestamp}`,
      '',
      'Summary:',
      `- Total targets identified: ${auditSummary.totalTargets}`,
      `- Targets engaged: ${auditSummary.engagedTargets}`,
      `- Targets neutralized successfully: ${auditSummary.successfulTargets}`,
      `- Target engagements without success: ${auditSummary.unsuccessfulTargets}`,
      `- Drones reported: ${auditSummary.reportedTargets}`,
      '- Identified drones (risk level · score):',
    ];

    targets.forEach((target) => {
      lines.push(`  • ${target.callSign}: ${target.riskLevel} · Score ${target.riskScore}`);
    });

    lines.push('', 'Identified Targets:');

    targets.forEach((target) => {
      lines.push(
        `• Potential drone identified at coordinates ${formatCoordinate(
          target.endPosition,
        )} with identification ${target.callSign}.`,
      );
    });

    lines.push('', 'Action Log:');

    if (actionLog.length === 0) {
      lines.push('No mitigation actions have been recorded during this session.');
    } else {
      actionLog.forEach((entry) => {
        const formattedCoordinate = entry.coordinates
          ? ` at coordinates ${formatCoordinate(entry.coordinates)}`
          : '';
        if (entry.actionKey === 'report' && entry.success) {
          lines.push(
            `[${entry.timestamp}] Operator filed a report on drone "${entry.callSign}"${formattedCoordinate}. ${entry.message}`,
          );
        } else if (entry.success) {
          lines.push(
            `[${entry.timestamp}] Operator acted on drone "${entry.callSign}" with action "${entry.actionLabel}" successfully${formattedCoordinate}. ${entry.message}`,
          );
        } else {
          lines.push(
            `[${entry.timestamp}] Operator acted on drone "${entry.callSign}" with action "${entry.actionLabel}" unsuccessfully${formattedCoordinate} because ${entry.message}`,
          );
        }
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drone-audit-log-${timestamp.replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [actionLog, auditSummary, formatCoordinate, targets]);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === detailsTargetId) || null,
    [detailsTargetId, targets],
  );

  useEffect(() => {
    if (
      selectedTargetId != null &&
      !filteredTargets.some((target) => target.id === selectedTargetId)
    ) {
      setSelectedTargetId(null);
    }

    if (
      detailsTargetId != null &&
      !filteredTargets.some((target) => target.id === detailsTargetId)
    ) {
      setDetailsTargetId(null);
    }
  }, [detailsTargetId, filteredTargets, selectedTargetId]);

  useEffect(() => {
    if (selectedTargetId == null) {
      return;
    }

    const element = listRefs.current[selectedTargetId];
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedTargetId]);

  useEffect(() => {
    Object.entries(trajectoryRefs.current).forEach(([id, polyline]) => {
      if (!polyline) {
        return;
      }

      const element = polyline.getElement();
      if (!element) {
        return;
      }

      const isSelected = Number(id) === selectedTargetId;
      element.classList.add('trajectory');
      element.classList.toggle('trajectory--selected', isSelected);

      if (isSelected) {
        polyline.bringToFront();
      }
    });

    Object.entries(startMarkerRefs.current).forEach(([id, marker]) => {
      if (!marker) {
        return;
      }

      const element = marker.getElement();
      if (!element) {
        return;
      }

      const isSelected = Number(id) === selectedTargetId;
      element.classList.add('drone-marker');
      element.classList.toggle('drone-marker--selected', isSelected);

      if (isSelected && typeof marker.bringToFront === 'function') {
        marker.bringToFront();
      }
    });

    Object.entries(endMarkerRefs.current).forEach(([id, marker]) => {
      if (!marker) {
        return;
      }

      const element = marker.getElement();
      if (!element) {
        return;
      }

      const isSelected = Number(id) === selectedTargetId;
      element.classList.add('drone-marker');
      element.classList.toggle('drone-marker--selected', isSelected);

      if (typeof marker.bringToFront === 'function') {
        if (isSelected) {
          marker.bringToFront();
        }
      } else if (typeof marker.setZIndexOffset === 'function') {
        marker.setZIndexOffset(isSelected ? 1000 : 0);
      }
    });
  }, [selectedTargetId]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (event.target.closest('.leaflet-popup') || event.target.closest('.leaflet-interactive')) {
        return;
      }

      mapRef.current?.closePopup();
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleSelectTarget = (targetId) => {
    setSelectedTargetId(targetId);
  };

  const handleCardKeyDown = (event, targetId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelectTarget(targetId);
    }
  };

  const handleDetailsOpen = (targetId) => {
    handleSelectTarget(targetId);
    setDetailsTargetId(targetId);
  };

  const moveTargetToEnd = useCallback((targetId) => {
    setTargetOrder((previousOrder) => {
      if (!previousOrder.includes(targetId)) {
        return previousOrder;
      }

      const nextOrder = previousOrder.filter((id) => id !== targetId);
      nextOrder.push(targetId);
      return nextOrder;
    });
  }, []);

  const animateTargetCompletion = useCallback(
    (targetId) => {
      const listItem = listRefs.current[targetId];
      const listElement = listItem?.parentElement;

      if (!listItem || !listElement) {
        moveTargetToEnd(targetId);
        return;
      }

      const distanceToEnd =
        listElement.scrollHeight - listItem.offsetTop - listItem.offsetHeight;

      if (distanceToEnd <= 0) {
        moveTargetToEnd(targetId);
        return;
      }

      if (typeof requestAnimationFrame !== 'function') {
        moveTargetToEnd(targetId);
        return;
      }

      listItem.classList.add('target-card--transitioning');
      listItem.style.willChange = 'transform';
      listItem.style.zIndex = '10';
      listItem.style.transition = 'transform 2s cubic-bezier(0.22, 0.61, 0.36, 1)';
      listItem.style.transform = 'translateY(0)';

      requestAnimationFrame(() => {
        listItem.style.transform = `translateY(${distanceToEnd}px)`;
      });

      const cleanupStyles = () => {
        const node = listRefs.current[targetId];
        if (!node) {
          return;
        }

        node.style.transition = '';
        node.style.transform = '';
        node.style.willChange = '';
        node.style.zIndex = '';
        node.classList.remove('target-card--transitioning');
      };

      const finalize = () => {
        moveTargetToEnd(targetId);
        requestAnimationFrame(cleanupStyles);
      };

      let fallbackTimer = null;

      const handleTransitionEnd = (event) => {
        if (event && event.propertyName && event.propertyName !== 'transform') {
          return;
        }

        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }

        listItem.removeEventListener('transitionend', handleTransitionEnd);
        finalize();
      };

      listItem.addEventListener('transitionend', handleTransitionEnd);

      fallbackTimer = setTimeout(() => {
        listItem.removeEventListener('transitionend', handleTransitionEnd);
        finalize();
      }, 900);
    },
    [moveTargetToEnd],
  );

  const handleAction = (target, actionKey) => {
    const definition = actionDefinitions[actionKey];
    const outcome = target.actionOutcomes?.[actionKey];
    const actionsUsedByTarget = usedActions[target.id] ?? [];
    const isActionAlreadyUsed = actionsUsedByTarget.includes(actionKey);

    if (!definition || !outcome || isActionAlreadyUsed) {
      return;
    }

    handleSelectTarget(target.id);

    const isSuccess = outcome === definition.successOutcome;
    const message = isSuccess ? definition.successMessage : definition.errorMessage;
    const status = isSuccess ? 'success' : 'error';
    const countsAsSuccess = isSuccess && actionKey !== 'report';
    const isReported = isSuccess && actionKey === 'report';
    const timestamp = new Date();

    const actionTimestamp = Date.now();

    setActionResults((prev) => ({
      ...prev,
      [target.id]: {
        label: definition.label,
        message,
        status,
        timestamp: actionTimestamp,
      },
    }));

    setVisibleActionTooltips((prev) => ({
      ...prev,
      [target.id]: true,
    }));

    if (actionTooltipTimersRef.current[target.id]) {
      clearTimeout(actionTooltipTimersRef.current[target.id]);
    }

    actionTooltipTimersRef.current[target.id] = setTimeout(() => {
      setVisibleActionTooltips((prev) => {
        if (!prev[target.id]) {
          return prev;
        }

        const { [target.id]: _removed, ...rest } = prev;
        return rest;
      });

      delete actionTooltipTimersRef.current[target.id];
    }, actionFeedbackDuration);

    setMitigatedTargets((prev) => ({
      ...prev,
      [target.id]: true,
    }));

    setActionLog((prev) => [
      ...prev,
      {
        timestamp: timestamp.toISOString(),
        targetId: target.id,
        callSign: target.callSign,
        actionKey,
        actionLabel: definition.label,
        success: isSuccess,
        countsAsSuccess,
        reported: isReported,
        message,
        coordinates: target.endPosition,
      },
    ]);

    setToast({
      id: target.id,
      label: `${definition.label} · ${target.callSign}`,
      message,
      status,
      timestamp: actionTimestamp,
    });

    const nextActionsForTarget = [...actionsUsedByTarget, actionKey];
    setUsedActions((prev) => ({
      ...prev,
      [target.id]: nextActionsForTarget,
    }));

    if (nextActionsForTarget.length >= totalActionCount) {
      animateTargetCompletion(target.id);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Drone Risk Dashboard</h1>
        <div className="app-header-actions">
          <button
            type="button"
            className={`layer-toggle${showRadioStations ? ' layer-toggle--active' : ''}`}
            onClick={toggleRadioStations}
            aria-pressed={showRadioStations}
            aria-label={showRadioStations ? 'Hide No-Fly Zones' : 'Show No-Fly Zones'}
            title={showRadioStations ? 'Hide No-Fly Zones' : 'Show No-Fly Zones'}
          >
            Mobile Interception Node
          </button>
          <nav className="risk-filter" aria-label="Filter drones by risk level">
            {riskLevels.map((level) => {
              const isActive = riskFilters.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  className={`risk-filter__button${isActive ? ' risk-filter__button--active' : ''}`}
                  style={{ '--risk-color': riskColors[level] }}
                  aria-pressed={isActive}
                  onClick={() => toggleRiskFilter(level)}
                >
                  <span className="risk-filter__swatch" aria-hidden />
                  <span className="risk-filter__label">{level}</span>
                </button>
              );
              })}
          </nav>
          <button type="button" className="download-button" onClick={handleDownloadLog}>
            Download Audit Log
          </button>
        </div>
      </header>
      <div className="app-body">
        <aside className="sidebar" aria-label="Target list">
          <h2>Targets</h2>
          <ul className="target-list">
            {filteredTargets.length === 0 ? (
              <li className="target-empty">No drones match the selected risk levels.</li>
            ) : (
              filteredTargets.map((target) => {
                const isSelected = selectedTargetId === target.id;
                const isDetailsOpen = detailsTargetId === target.id;

                return (
                  <li
                    key={target.id}
                    ref={(node) => {
                      if (node) {
                        listRefs.current[target.id] = node;
                      } else {
                        delete listRefs.current[target.id];
                      }
                    }}
                    className={`target-card${isSelected ? ' target-card--selected' : ''}${
                      isDetailsOpen ? ' target-card--active' : ''
                    }`}
                    onClick={() => handleSelectTarget(target.id)}
                    onKeyDown={(event) => handleCardKeyDown(event, target.id)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                  >
                    <div
                      className="target-card__risk-header"
                      style={{ backgroundColor: riskColors[target.riskLevel] }}
                      aria-hidden
                    />
                    <div className="target-content">
                      <div className="target-header">
                        <strong>{target.callSign}</strong>
                        <button
                          type="button"
                          className="details-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDetailsOpen(target.id);
                          }}
                          aria-haspopup="dialog"
                          aria-expanded={isDetailsOpen}
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
                      <div className="action-panel action-panel--inline">
                        <h4>Response actions</h4>
                        <div className="action-buttons" role="group" aria-label="Mitigation actions">
                          {Object.entries(actionDefinitions).map(([key, definition]) => {
                            const outcome = target.actionOutcomes?.[key];
                            const actionsUsedForTarget = usedActions[target.id] ?? [];
                            const isActionUsed = actionsUsedForTarget.includes(key);
                            const allActionsUsed = actionsUsedForTarget.length >= totalActionCount;
                            const shouldDisable = !outcome || isActionUsed || allActionsUsed;
                            const buttonClassName = `${definition.buttonClass}${
                              isActionUsed || allActionsUsed ? ' action-button--deactivated' : ''
                            }`;
                            return (
                              <button
                                key={key}
                                type="button"
                                className={buttonClassName}
                                onClick={() => handleAction(target, key)}
                                disabled={shouldDisable}
                              >
                                {definition.label}
                              </button>
                            );
                          })}
                        </div>
                        {actionResults[target.id] && (
                          <div
                            className={`action-status action-status--${actionResults[target.id].status}`}
                            role="status"
                          >
                            <span className="action-status-label">{actionResults[target.id].label}</span>
                            <span className="action-status-message">{actionResults[target.id].message}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </aside>
        <main className="map-wrapper" aria-label="Map display">
          {toast && (
            <div
              key={toast.timestamp}
              className={`action-toast action-toast--${toast.status}`}
              role="status"
              aria-live="polite"
            >
              <strong>{toast.label}</strong>
              <span>{toast.message}</span>
            </div>
          )}
          <MapContainer
            center={polandCenter}
            zoom={polandZoom}
            minZoom={mapMinZoom}
            maxZoom={mapMaxZoom}
            zoomSnap={0.5}
            maxBounds={regionalBounds}
            maxBoundsViscosity={1}
            className="map-container"
            whenCreated={(mapInstance) => {
              mapRef.current = mapInstance;
            }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {showRadioStations &&
              radioStations.map((station) => {
                const isStationEngaged = engagedStations.has(station.id);
                const isActiveStation = activeStationId === station.id;
                const coverageClassName = [
                  'radio-coverage',
                  isStationEngaged ? 'radio-coverage--active' : '',
                  isActiveStation ? 'radio-coverage--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                const coverageKey = `${station.id}-${
                  isStationEngaged ? 'engaged' : 'idle'
                }-${isActiveStation ? 'selected' : 'default'}`;

                return (
                  <Fragment key={coverageKey}>
                    {notifyingStations.has(station.id) && (
                      <Marker
                        position={station.position}
                        icon={radioNotificationIcon}
                        interactive={false}
                      />
                    )}
                    <Circle
                      center={station.position}
                      radius={radioCoverageRadiusMeters}
                      pathOptions={{
                        ...radioCoverageStyle,
                        className: coverageClassName,
                      }}
                      eventHandlers={{
                        click: () => handleStationSelect(station.id),
                      }}
                    />
                    <Marker
                      position={station.position}
                      icon={radioStationIcon}
                      eventHandlers={{
                        click: () => handleStationSelect(station.id),
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -28]} interactive>
                        <div className="radio-tooltip">
                          <strong>{station.name}</strong>
                          <br />
                          Coverage radius: 30 km
                          <div className="radio-tooltip__actions">
                            <button
                              type="button"
                              className="radio-tooltip__notify-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleNotifyStation(station.id);
                              }}
                              disabled={!isStationEngaged || notifyingStations.has(station.id)}
                            >
                              Notify
                            </button>
                            {!isStationEngaged && (
                              <span className="radio-tooltip__status radio-tooltip__status--idle">
                                No tracked drones inside coverage
                              </span>
                            )}
                            {isStationEngaged && !notifyingStations.has(station.id) && (
                              <span className="radio-tooltip__status radio-tooltip__status--armed">
                                Drone detected in airspace
                              </span>
                            )}
                            {notifyingStations.has(station.id) && (
                              <span
                                className="radio-tooltip__status radio-tooltip__status--sent"
                                role="status"
                              >
                                Notification dispatched
                              </span>
                            )}
                          </div>
                        </div>
                      </Tooltip>
                    </Marker>
                  </Fragment>
                );
              })}
            {filteredTargets.map((target) => {
              const pathColor = mitigatedTargets[target.id]
                ? mitigationColor
                : riskColors[target.riskLevel];
              // const isTargetCovered = coveredTargets.has(target.id);

              return (
                <Fragment key={target.id}>
                  <Polyline
                    ref={(instance) => {
                      if (instance) {
                        trajectoryRefs.current[target.id] = instance;
                      } else {
                        delete trajectoryRefs.current[target.id];
                      }
                    }}
                    positions={target.track}
                    pathOptions={{
                      ...trajectoryOptions,
                      color: pathColor,
                      className: 'trajectory',
                    }}
                    eventHandlers={{
                      click: () => handleSelectTarget(target.id),
                    }}
                  />
                  <CircleMarker
                    ref={(instance) => {
                      if (instance) {
                        startMarkerRefs.current[target.id] = instance;
                      } else {
                        delete startMarkerRefs.current[target.id];
                      }
                    }}
                    center={target.startPosition}
                    pathOptions={startMarkerOptions}
                    eventHandlers={{
                      click: () => handleSelectTarget(target.id),
                    }}
                  >
                    <Popup>
                      <strong>{target.callSign}</strong>
                      <br />
                      Launch position: {formatCoordinate(target.startPosition)}
                    </Popup>
                  </CircleMarker>
                  {/*{isTargetCovered && (*/}
                  {/*  <CircleMarker*/}
                  {/*    center={target.endPosition}*/}
                  {/*    radius={18}*/}
                  {/*    interactive={false}*/}
                  {/*    pane="shadowPane"*/}
                  {/*    pathOptions={{*/}
                  {/*      color: '#1d4ed8',*/}
                  {/*      weight: 2,*/}
                  {/*      fill: true,*/}
                  {/*      fillColor: '#3b82f6',*/}
                  {/*      fillOpacity: 0.18,*/}
                  {/*      className: 'drone-coverage',*/}
                  {/*    }}*/}
                  {/*  />*/}
                  {/*)}*/}
                  <Marker
                    ref={(instance) => {
                      if (instance) {
                        endMarkerRefs.current[target.id] = instance;
                      } else {
                        delete endMarkerRefs.current[target.id];
                      }
                    }}
                    position={target.endPosition}
                    icon={getDroneIcon(target.riskLevel, target.heading)}
                    eventHandlers={{
                      click: () => handleSelectTarget(target.id),
                    }}
                  >
                    <Popup>
                      <strong>{target.callSign}</strong>
                      <br />
                      Current position: {formatCoordinate(target.endPosition)}
                      <br />
                      Risk: {target.riskLevel} ({target.riskScore})
                    </Popup>
                    {actionResults[target.id] && visibleActionTooltips[target.id] && (
                      <Tooltip
                        direction="top"
                        offset={[0, -26]}
                        permanent
                        className={`action-tooltip action-tooltip--${actionResults[target.id].status}`}
                      >
                        <span className="action-tooltip-label">{actionResults[target.id].label}</span>
                        <span className="action-tooltip-message">{actionResults[target.id].message}</span>
                      </Tooltip>
                    )}
                  </Marker>
                </Fragment>
              );
            })}
          </MapContainer>
          {activeStation && activeStationIsEngaged && (
            <div
              className="station-info-panel"
              role="dialog"
              aria-modal="false"
              aria-label={`${activeStation.name} coverage details`}
            >
              <div className="station-info-panel__header">
                <div>
                  <h3>{activeStation.name}</h3>
                  <p>Coverage radius: 30 km</p>
                </div>
                <button
                  type="button"
                  className="station-info-panel__close"
                  aria-label="Close station details"
                  onClick={handleStationPanelClose}
                >
                  ×
                </button>
              </div>
              <div className="station-info-panel__content">
                <div className="radio-tooltip__actions">
                  <button
                    type="button"
                    className="radio-tooltip__notify-button"
                    onClick={() => handleNotifyStation(activeStation.id, { dismissPanel: true })}
                    disabled={!activeStationIsEngaged || notifyingStations.has(activeStation.id)}
                  >
                    Notify
                  </button>
                  {!notifyingStations.has(activeStation.id) && (
                    <span className="radio-tooltip__status radio-tooltip__status--armed">
                      Drone detected in airspace
                    </span>
                  )}
                  {notifyingStations.has(activeStation.id) && (
                    <span
                      className="radio-tooltip__status radio-tooltip__status--sent"
                      role="status"
                    >
                      Notification dispatched
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="map-legend" aria-label="Risk legend">
            <h3>Risk Legend</h3>
            <ul>
              {legendItems.map((item) => (
                <li key={item.key}>
                  <span className="legend-swatch" style={{ backgroundColor: item.color }} aria-hidden />
                  {item.label}
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
              <span className="legend-entry">
                <span className="legend-radio" aria-hidden />
                Mobile intercept station
              </span>
            </div>
          </div>
        </main>
        {selectedTarget && (
          <div className="modal-overlay" role="presentation" onClick={() => setDetailsTargetId(null)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`target-modal-${selectedTarget.id}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title-group">
                  <span
                    className="risk-indicator"
                    style={{ backgroundColor: riskColors[selectedTarget.riskLevel] }}
                    aria-hidden
                  />
                  <div>
                    <h2 id={`target-modal-${selectedTarget.id}`}>{selectedTarget.callSign}</h2>
                    <p className="modal-subtitle">
                      Risk {selectedTarget.riskLevel} · Score {selectedTarget.riskScore}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  aria-label="Close details"
                  onClick={() => setDetailsTargetId(null)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <dl className="modal-meta">
                  <div>
                    <dt>Launch position</dt>
                    <dd>{formatCoordinate(selectedTarget.startPosition)}</dd>
                  </div>
                  <div>
                    <dt>Current position</dt>
                    <dd>{formatCoordinate(selectedTarget.endPosition)}</dd>
                  </div>
                </dl>
                <h3>Risk factor breakdown</h3>
                <ul className="factor-breakdown">
                  {Object.entries(riskWeights).map(([factor, weight]) => {
                    const triggered = selectedTarget.riskFactors[factor];
                    const points = triggered ? weight : 0;
                    return (
                      <li key={factor}>
                        <span className="factor-label">
                          <span
                            className="factor-help"
                            tabIndex={0}
                            aria-label={riskFactorDescriptions[factor]}
                          >
                            <span aria-hidden>?</span>
                            <span className="factor-help__tooltip" role="tooltip">
                              {riskFactorDescriptions[factor]}
                            </span>
                          </span>
                          <span className="factor-label__text">{riskFactorDetails[factor]}</span>
                        </span>
                        <span className="factor-result">
                          {triggered ? 'Yes' : 'No'}
                          <span className="factor-points">{` (+${points})`}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
