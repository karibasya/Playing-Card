import React, { useEffect, useMemo, useRef, useState } from 'react';

type Scan = {
  id: string;
  uid: string;
  device_id?: string;
  rssi?: number;
  timestamp: string;
};

type Props = {
  apiBase?: string; // e.g. http://localhost:8000
};

const defaultApiBase = '';

export function RFIDLive({ apiBase = defaultApiBase }: Props) {
  const [scans, setScans] = useState<Scan[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const wsUrl = useMemo(() => {
    const base = apiBase || '';
    try {
      const url = new URL(base || window.location.origin);
      url.protocol = url.protocol.replace('http', 'ws');
      url.pathname = '/ws/scans';
      return url.toString();
    } catch {
      return `ws://${window.location.host}/ws/scans`;
    }
  }, [apiBase]);

  useEffect(() => {
    // load recent history
    const controller = new AbortController();
    fetch(`${apiBase}/api/scans?limit=50`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: Scan[]) => setScans(data))
      .catch(() => {});
    return () => controller.abort();
  }, [apiBase]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === 'scan' && msg.data) {
          setScans((prev) => [msg.data as Scan, ...prev].slice(0, 100));
        }
      } catch {
        // ignore
      }
    };
    ws.onopen = () => {
      // optional ping
    };
    ws.onerror = () => {};
    ws.onclose = () => {};
    return () => ws.close();
  }, [wsUrl]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>RFID Live Scans</h2>
      <div style={{ fontSize: 12, color: '#666' }}>WS: {wsUrl}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Time</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>UID</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Device</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>RSSI</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.id}>
              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '8px' }}>{new Date(s.timestamp).toLocaleString()}</td>
              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '8px', fontFamily: 'monospace' }}>{s.uid}</td>
              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '8px' }}>{s.device_id || '-'}</td>
              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '8px' }}>{s.rssi ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RFIDLive;


