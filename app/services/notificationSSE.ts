// services/notificationSSE.ts
export const subscribeToNotifications = (
  userId: string, 
  onNotification: (data: any) => void
) => {
  const eventSource = new EventSource(
    `https://your-api.com/notifications/stream?user=${userId}`
  );

  eventSource.onmessage = (event) => {
    const notification = JSON.parse(event.data);
    onNotification(notification);
  };

  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    eventSource.close();
  };

  return eventSource;
};