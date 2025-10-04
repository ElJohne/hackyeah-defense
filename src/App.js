import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Popup,
  Polyline,
  CircleMarker,
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

const toRadians = (value) => (value * Math.PI) / 180;
const toDegrees = (value) => (value * 180) / Math.PI;

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
    actionOutcomes: {
      simDetach: 'allowed',
      cyberTakeover: 'failed',
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
  const [usedActions, setUsedActions] = useState({});
  const [targetOrder, setTargetOrder] = useState(() => rawTargets.map((target) => target.id));
  const listRefs = useRef({});
  const trajectoryRefs = useRef({});
  const startMarkerRefs = useRef({});
  const endMarkerRefs = useRef({});
  const actionTooltipTimersRef = useRef({});
  const droneIconCacheRef = useRef({});
  const mapRef = useRef(null);
  const polandCenter = [52.0976, 19.1451];
  const polandZoom = 6.5;
  const mapMinZoom = 5.5;
  const mapMaxZoom = 20;
  const regionalBounds = [
    [47.0, 11.0],
    [56.0, 27.0],
  ];

  const targets = useMemo(
    () =>
      rawTargets.map((target, index) => {
        const riskFactors = {
          ...target.riskFactors,
          noSpeedChangeWaterLand: Math.random() < 0.5,
        };

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
      setTargetOrder((previousOrder) => {
        if (!previousOrder.includes(target.id)) {
          return previousOrder;
        }

        const nextOrder = previousOrder.filter((id) => id !== target.id);
        nextOrder.push(target.id);
        return nextOrder;
      });
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Drone Risk Dashboard</h1>
        <div className="app-header-actions">
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
            {filteredTargets.map((target) => {
              const pathColor = mitigatedTargets[target.id]
                ? mitigationColor
                : riskColors[target.riskLevel];

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
                        <span className="factor-label">{riskFactorDetails[factor]}</span>
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
