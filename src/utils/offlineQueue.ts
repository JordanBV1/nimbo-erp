/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface QueuedAction {
  id: string;
  endpoint: string;
  method: "POST" | "PUT";
  payload: any;
  timestamp: string;
}

const QUEUE_KEY = "nimbo_offline_sync_queue";

export const offlineQueue = {
  getQueue(): QueuedAction[] {
    try {
      const data = localStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  enqueue(endpoint: string, method: "POST" | "PUT", payload: any) {
    const queue = this.getQueue();
    const action: QueuedAction = {
      id: "act_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
      endpoint,
      method,
      payload,
      timestamp: new Date().toISOString()
    };
    queue.push(action);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    // Trigger custom event so header stats update
    window.dispatchEvent(new Event("offline-queue-changed"));
  },

  dequeue(id: string) {
    let queue = this.getQueue();
    queue = queue.filter((x) => x.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event("offline-queue-changed"));
  },

  clear() {
    localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new Event("offline-queue-changed"));
  },

  async syncWithServer(onSuccessItem?: (action: QueuedAction) => void): Promise<boolean> {
    const queue = this.getQueue();
    if (queue.length === 0) return true;

    console.log(`Starting synchronization of ${queue.length} offline actions...`);
    let allSucceeded = true;

    for (const action of queue) {
      try {
        const response = await fetch(action.endpoint, {
          method: action.method,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(action.payload)
        });

        if (response.ok) {
          this.dequeue(action.id);
          if (onSuccessItem) onSuccessItem(action);
        } else {
          allSucceeded = false;
        }
      } catch (err) {
        console.error("Offline sync item failed:", err);
        allSucceeded = false;
        break; // Stop syncing if connection is lost again
      }
    }

    return allSucceeded;
  }
};
