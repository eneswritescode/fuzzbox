/**
 * Zero-dependency, single-file HTML dashboard for controlling Fuzzbox.
 * Dark theme, vanilla JS, no build step required.
 */
export const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fuzzbox Control Panel</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Courier New', monospace;
      background: #0d1117;
      color: #c9d1d9;
      padding: 2rem;
      line-height: 1.6;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    header {
      border-bottom: 2px solid #30363d;
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }

    h1 {
      color: #58a6ff;
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: #8b949e;
      font-size: 0.9rem;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 1rem;
    }

    .stat-label {
      color: #8b949e;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      color: #58a6ff;
      font-size: 1.8rem;
      font-weight: bold;
      margin-top: 0.5rem;
    }

    .controls {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .control-group {
      margin-bottom: 1.5rem;
    }

    .control-group:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      color: #c9d1d9;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }

    input[type="range"] {
      width: 100%;
      height: 6px;
      background: #30363d;
      border-radius: 3px;
      outline: none;
      -webkit-appearance: none;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      background: #58a6ff;
      border-radius: 50%;
      cursor: pointer;
    }

    input[type="range"]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      background: #58a6ff;
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }

    .slider-value {
      display: inline-block;
      margin-left: 1rem;
      color: #58a6ff;
      font-weight: bold;
    }

    button {
      background: #238636;
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-size: 1rem;
      font-family: 'Courier New', monospace;
      cursor: pointer;
      transition: background 0.2s;
      margin-right: 1rem;
      margin-bottom: 0.5rem;
    }

    button:hover {
      background: #2ea043;
    }

    button.danger {
      background: #da3633;
    }

    button.danger:hover {
      background: #f85149;
    }

    button.warning {
      background: #9e6a03;
    }

    button.warning:hover {
      background: #bb8009;
    }

    button:disabled {
      background: #30363d;
      color: #6e7681;
      cursor: not-allowed;
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .toggle-switch {
      position: relative;
      width: 50px;
      height: 26px;
      background: #30363d;
      border-radius: 13px;
      cursor: pointer;
      transition: background 0.3s;
    }

    .toggle-switch.active {
      background: #238636;
    }

    .toggle-switch::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      background: #ffffff;
      border-radius: 50%;
      transition: left 0.3s;
    }

    .toggle-switch.active::after {
      left: 27px;
    }

    .spike-status {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: #da3633;
      color: #ffffff;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-left: 1rem;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    footer {
      text-align: center;
      color: #8b949e;
      font-size: 0.85rem;
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #30363d;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎸 Fuzzbox Control Panel</h1>
      <p class="subtitle">Live chaos engineering dashboard. Break things before your users do.</p>
    </header>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Total Requests</div>
        <div class="stat-value" id="requestCount">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Chaos Injected</div>
        <div class="stat-value" id="chaosCount">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Chaos Rate</div>
        <div class="stat-value" id="chaosRate">0%</div>
      </div>
    </div>

    <div class="controls">
      <div class="control-group">
        <div class="toggle">
          <label>Enable Fuzzbox</label>
          <div class="toggle-switch active" id="enableToggle"></div>
        </div>
      </div>

      <div class="control-group">
        <label>
          Chaos Probability
          <span class="slider-value" id="probabilityValue">10%</span>
        </label>
        <input type="range" id="probabilitySlider" min="0" max="100" value="10">
      </div>

      <div class="control-group">
        <button id="spikeBtn" class="warning">Activate Spike Mode (80% for 30s)</button>
        <span id="spikeStatus" class="spike-status" style="display: none;">SPIKE MODE ACTIVE</span>
      </div>

      <div class="control-group">
        <button id="resetBtn" class="danger">Reset Stats</button>
      </div>
    </div>

    <footer>
      Fuzzbox is running. Your server is vulnerable by design. That's the point.
    </footer>
  </div>

  <script>
    let state = {
      enabled: true,
      probability: 0.1,
      spikeMode: false,
      requestCount: 0,
      chaosCount: 0,
    };

    // Fetch current state from the server
    async function fetchState() {
      try {
        const res = await fetch('/__fuzzbox/api/state');
        const data = await res.json();
        state = data;
        updateUI();
      } catch (err) {
        console.error('Failed to fetch state:', err);
      }
    }

    // Update UI based on state
    function updateUI() {
      document.getElementById('enableToggle').classList.toggle('active', state.enabled);
      document.getElementById('probabilitySlider').value = Math.round(state.probability * 100);
      document.getElementById('probabilityValue').textContent = Math.round(state.probability * 100) + '%';
      document.getElementById('requestCount').textContent = state.requestCount;
      document.getElementById('chaosCount').textContent = state.chaosCount;

      const rate = state.requestCount > 0 
        ? Math.round((state.chaosCount / state.requestCount) * 100) 
        : 0;
      document.getElementById('chaosRate').textContent = rate + '%';

      const spikeStatus = document.getElementById('spikeStatus');
      if (state.spikeMode) {
        spikeStatus.style.display = 'inline-block';
      } else {
        spikeStatus.style.display = 'none';
      }
    }

    // Send state update to the server
    async function updateState(updates) {
      try {
        const res = await fetch('/__fuzzbox/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        state = data;
        updateUI();
      } catch (err) {
        console.error('Failed to update state:', err);
      }
    }

    // Event listeners
    document.getElementById('enableToggle').addEventListener('click', () => {
      updateState({ enabled: !state.enabled });
    });

    document.getElementById('probabilitySlider').addEventListener('input', (e) => {
      const value = parseInt(e.target.value) / 100;
      updateState({ probability: value });
    });

    document.getElementById('spikeBtn').addEventListener('click', () => {
      updateState({ spikeMode: true });
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      updateState({ reset: true });
    });

    // Poll for state updates every 2 seconds
    fetchState();
    setInterval(fetchState, 2000);
  </script>
</body>
</html>
`;
