/**
 * WebSocket Connection Manager
 * Handles reconnection logic, message queuing, and connection state
 */

import { Socket, io } from "socket.io-client";

export interface ConnectionState {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  reconnectAttempts: number;
  lastConnected?: Date;
}

export class SocketConnectionManager {
  private socket: Socket | null = null;
  private wsUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private messageQueue: Array<{ event: string; data: any }> = [];
  private isManuallyDisconnected = false;
  private listeners: Map<string, Set<Function>> = new Map();
  private stateCallbacks: Set<(state: ConnectionState) => void> = new Set();

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.isManuallyDisconnected = false;
    this.socket = io(this.wsUrl, {
      transports: ["polling", "websocket"],
      reconnection: false, // We handle reconnection manually
      timeout: 10000,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("[Socket] Connected successfully");
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.updateState({ status: 'connected', reconnectAttempts: 0, lastConnected: new Date() });
      
      // Process queued messages
      this.processMessageQueue();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      
      if (this.isManuallyDisconnected) {
        this.updateState({ status: 'disconnected', reconnectAttempts: 0 });
        return;
      }

      // Auto-reconnect unless it's a manual disconnect or auth error
      if (reason === "io server disconnect") {
        // Server disconnected us, try to reconnect
        this.scheduleReconnect();
      } else {
        // Client-side disconnect, try to reconnect
        this.scheduleReconnect();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      this.updateState({ status: 'error', reconnectAttempts: this.reconnectAttempts });
      
      if (!this.isManuallyDisconnected) {
        this.scheduleReconnect();
      }
    });

    // Forward all other events to registered listeners
    this.socket.onAny((event, ...args) => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener(...args);
          } catch (error) {
            console.error(`[Socket] Error in listener for ${event}:`, error);
          }
        });
      }
    });
  }

  private scheduleReconnect() {
    if (this.isManuallyDisconnected || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateState({ 
        status: 'error', 
        reconnectAttempts: this.reconnectAttempts 
      });
      return;
    }

    this.reconnectAttempts++;
    this.updateState({ 
      status: 'reconnecting', 
      reconnectAttempts: this.reconnectAttempts 
    });

    // Exponential backoff with jitter
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    ) + Math.random() * 1000; // Add jitter

    console.log(`[Socket] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (!this.isManuallyDisconnected && this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  private processMessageQueue() {
    if (!this.socket?.connected || this.messageQueue.length === 0) {
      return;
    }

    console.log(`[Socket] Processing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const { event, data } = this.messageQueue.shift()!;
      try {
        this.socket.emit(event, data);
      } catch (error) {
        console.error(`[Socket] Error sending queued message ${event}:`, error);
      }
    }
  }

  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      // Queue message for when connection is restored
      console.log(`[Socket] Queueing message ${event} (not connected)`);
      this.messageQueue.push({ event, data });
      
      // Limit queue size to prevent memory issues
      if (this.messageQueue.length > 100) {
        console.warn("[Socket] Message queue too large, dropping oldest messages");
        this.messageQueue.shift();
      }
    }
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Also register with socket if it exists
    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  off(event: string, callback?: Function): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    } else {
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  private updateState(state: ConnectionState) {
    this.stateCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error("[Socket] Error in state callback:", error);
      }
    });
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    if (this.socket) {
      this.socket.disconnect();
    }
    this.messageQueue = [];
    this.updateState({ status: 'disconnected', reconnectAttempts: 0 });
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getState(): ConnectionState {
    return {
      status: this.isConnected() ? 'connected' : 
              this.isManuallyDisconnected ? 'disconnected' : 
              this.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected',
      reconnectAttempts: this.reconnectAttempts,
      lastConnected: this.socket?.connected ? new Date() : undefined,
    };
  }
}

