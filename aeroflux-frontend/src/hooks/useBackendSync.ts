import { useEffect, useRef, useCallback } from 'react';
import { useSimulation } from '../context/SimulationContext';
import type { AgentMessage } from '../types/flight';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || null;

export function useBackendSync() {
  const {
    isRunning,
    addAgentMessage,
    acceptRecommendation: localAccept,
    dismissRecommendation: localDismiss,
    injectEvent: localInject,
  } = useSimulation();
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!BACKEND_URL || !isRunning) return;
    
    try {
      const ws = new WebSocket(`${BACKEND_URL.replace(/^http/, 'ws')}/ws/live`);
      
      ws.onopen = () => {
        console.log('[AeroFlux] WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          switch (msg.type) {
            case 'snapshot':
              // Update flight state from backend
              break;
            case 'recommendation':
              // Show recommendation from backend
              break;
            case 'agent_message':
              const agentMsg: AgentMessage = {
                id: msg.data.id || `ws-${Date.now()}`,
                agent: msg.data.agent,
                timestamp: Date.now(),
                sim_elapsed: msg.data.sim_elapsed,
                severity: msg.data.severity,
                message: msg.data.message,
                finding: msg.data.finding,
              };
              addAgentMessage(agentMsg);
              break;
          }
        } catch (err) {
          console.error('[AeroFlux] WebSocket message error:', err);
        }
      };
      
      ws.onclose = () => {
        console.log('[AeroFlux] WebSocket disconnected');
        // Attempt reconnect
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
      
      ws.onerror = (err) => {
        console.error('[AeroFlux] WebSocket error:', err);
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('[AeroFlux] WebSocket connection failed:', err);
    }
  }, [isRunning, addAgentMessage]);

  useEffect(() => {
    if (BACKEND_URL && isRunning) {
      connect();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, isRunning]);

  const acceptRecommendation = async (id: string) => {
    if (!BACKEND_URL) {
      localAccept(id);
      return;
    }
    
    try {
      await fetch(`${BACKEND_URL}/api/recommendation/${id}/accept`, { 
        method: 'POST' 
      });
      localAccept(id);
    } catch (err) {
      console.error('[AeroFlux] Failed to accept recommendation:', err);
      localAccept(id);
    }
  };

  const dismissRecommendation = async (id: string) => {
    if (!BACKEND_URL) {
      localDismiss(id);
      return;
    }
    
    try {
      await fetch(`${BACKEND_URL}/api/recommendation/${id}/dismiss`, { 
        method: 'POST' 
      });
      localDismiss(id);
    } catch (err) {
      console.error('[AeroFlux] Failed to dismiss recommendation:', err);
      localDismiss(id);
    }
  };

  const injectEvent = async (eventType: string) => {
    if (!BACKEND_URL) {
      localInject(eventType);
      return;
    }
    
    try {
      await fetch(`${BACKEND_URL}/api/inject-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType })
      });
      localInject(eventType);
    } catch (err) {
      console.error('[AeroFlux] Failed to inject event:', err);
      localInject(eventType);
    }
  };

  return {
    isConnected: !!wsRef.current && wsRef.current.readyState === WebSocket.OPEN,
    acceptRecommendation,
    dismissRecommendation,
    injectEvent,
  };
}
