import { useState, useEffect } from 'react';
import { checkHealth } from './services/api';
import './App.css';

export default function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchHealthStatus = async () => {
    setLoading(true);
    const data = await checkHealth();
    setHealth(data);
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => {
    fetchHealthStatus();
  }, []);

  const isServerOnline = health && health.status === 'online';
  const isDbOnline = health && health.database && health.database.connected;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-badge">
          <span className="brand-badge-dot"></span>
          Full-Stack Framework
        </div>
        <h1 className="main-title">React + Node.js + PostgreSQL</h1>
        <p className="subtitle">
          Clean, modern baseline framework ready for building your application.
        </p>
      </header>

      {/* Status Grid */}
      <div className="status-grid">
        {/* Frontend Card */}
        <div className="status-card">
          <div className="card-top">
            <div>
              <div className="tier-label">Frontend</div>
              <div className="tier-name">React + Vite</div>
            </div>
            <div className="status-indicator online">
              <span className="status-dot"></span>
              Operational
            </div>
          </div>
          <div className="card-details">
            <div className="detail-row">
              <span>Port</span>
              <span className="value">3000</span>
            </div>
            <div className="detail-row">
              <span>Environment</span>
              <span className="value">{import.meta.env.MODE}</span>
            </div>
            <div className="detail-row">
              <span>Proxy Route</span>
              <span className="value">/api → localhost:5000</span>
            </div>
          </div>
        </div>

        {/* Backend Card */}
        <div className="status-card">
          <div className="card-top">
            <div>
              <div className="tier-label">Backend</div>
              <div className="tier-name">Node.js + Express</div>
            </div>
            <div className={`status-indicator ${isServerOnline ? 'online' : 'offline'}`}>
              <span className="status-dot"></span>
              {isServerOnline ? 'Online' : 'Offline'}
            </div>
          </div>
          <div className="card-details">
            <div className="detail-row">
              <span>Port</span>
              <span className="value">5000</span>
            </div>
            <div className="detail-row">
              <span>Uptime</span>
              <span className="value">{isServerOnline ? `${health.uptimeSeconds}s` : 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span>Endpoint</span>
              <span className="value">/api/health</span>
            </div>
          </div>
        </div>

        {/* Database Card */}
        <div className="status-card">
          <div className="card-top">
            <div>
              <div className="tier-label">Database</div>
              <div className="tier-name">PostgreSQL</div>
            </div>
            <div className={`status-indicator ${isDbOnline ? 'online' : 'warning'}`}>
              <span className="status-dot"></span>
              {isDbOnline ? 'Connected' : 'Pending Config'}
            </div>
          </div>
          <div className="card-details">
            <div className="detail-row">
              <span>Driver</span>
              <span className="value">node-postgres (pg)</span>
            </div>
            <div className="detail-row">
              <span>Database</span>
              <span className="value">{isDbOnline ? health.database.database : 'jagobridge'}</span>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <span className="value">
                {isDbOnline ? 'Ready for queries' : 'Check server/.env'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info & Structure */}
      <div className="info-section">
        {/* Directory Structure */}
        <div className="panel">
          <h2 className="panel-title">📁 Project Structure</h2>
          <ul className="tree-list">
            <li><span className="tree-folder">client/</span> <span className="tree-desc">— React UI (Vite, CSS, Services)</span></li>
            <li>&nbsp;&nbsp;├── src/services/api.js <span className="tree-desc">— API client helper</span></li>
            <li>&nbsp;&nbsp;├── src/App.jsx <span className="tree-desc">— Root React application</span></li>
            <li>&nbsp;&nbsp;└── vite.config.js <span className="tree-desc">— Port 3000 & /api reverse proxy</span></li>
            <li><span className="tree-folder">server/</span> <span className="tree-desc">— Node.js API (Express, PG Pool)</span></li>
            <li>&nbsp;&nbsp;├── src/config/db.js <span className="tree-desc">— PostgreSQL connection pool</span></li>
            <li>&nbsp;&nbsp;├── src/routes/api.js <span className="tree-desc">— Modular API router</span></li>
            <li>&nbsp;&nbsp;├── src/server.js <span className="tree-desc">— HTTP server entrypoint</span></li>
            <li>&nbsp;&nbsp;└── .env <span className="tree-desc">— DB & Port configuration</span></li>
            <li><span className="tree-folder">package.json</span> <span className="tree-desc">— Root orchestration scripts</span></li>
          </ul>
        </div>

        {/* Quick Commands */}
        <div className="panel">
          <h2 className="panel-title">⚡ Quick Commands</h2>
          <div className="code-block">
            # Start both Client and Server concurrently<br />
            npm run dev<br /><br />
            # Start individually<br />
            npm run dev:client &nbsp;&nbsp;# React on http://localhost:3000<br />
            npm run dev:server &nbsp;&nbsp;# Express on http://localhost:5000<br /><br />
            # Install all dependencies across both tiers<br />
            npm run install:all
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <button
          className="btn-primary"
          onClick={fetchHealthStatus}
          disabled={loading}
        >
          {loading ? 'Testing...' : '🔄 Recheck System Health'}
        </button>
        {lastUpdated && (
          <span className="last-checked">Last checked: {lastUpdated}</span>
        )}
      </div>
    </div>
  );
}
