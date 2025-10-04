import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Drone Risk Dashboard</h1>
      </header>
      <div className="app-body">
        <aside className="sidebar" aria-label="Target list" />
        <main className="map-container" aria-label="Map display" />
      </div>
    </div>
  );
}

export default App;
