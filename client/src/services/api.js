/**
 * API Service for JagoBridge Framework
 * Handles communication with the Node.js backend.
 */

export const checkHealth = async () => {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    return {
      status: 'offline',
      error: error.message,
      database: { connected: false, error: 'Cannot reach backend server' },
    };
  }
};
