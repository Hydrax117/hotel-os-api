# Real-Time Notifications for Restaurants

## Overview

The Hotel OS API now includes **instant real-time notifications** using WebSockets (Socket.IO). When a guest books a room or an order is placed, restaurant staff are instantly notified **without needing to refresh**.

## Features

✅ **Instant Notifications** - Messages delivered in real-time  
✅ **No Polling** - WebSocket-based push notifications  
✅ **Multiple Events** - New bookings, confirmations, cancellations, status updates  
✅ **Scalable** - Supports thousands of concurrent connections  
✅ **Room-based Routing** - Each hotel gets its own notification channel  

## Technology Stack

- **Backend**: NestJS WebSocket Gateway
- **Frontend**: Socket.IO Client (JavaScript/TypeScript)
- **Transport**: WebSocket with fallback to HTTP long-polling
- **Authentication**: JWT Token-based

## Backend Setup

### Installed Dependencies

```bash
npm install @nestjs/websockets @nestjs/platform-ws socket.io socket.io-client
```

### Gateway Location

- **File**: `src/notifications/notifications.gateway.ts`
- **Endpoint**: `ws://localhost:3001/socket.io` (WebSocket namespace: `/notifications`)

### Events Emitted

#### 1. **New Order/Booking Placed**
```typescript
// Event: 'new-order'
{
  bookingId: string,
  reference: string,                    // e.g., "HOS-12345"
  guestName: string,                    // "John Doe"
  guestPhone: string,                   // "+1234567890"
  guestEmail: string,                   // "john@example.com"
  roomType: string,                     // "Deluxe Suite"
  checkIn: string,                      // "2025-11-15"
  checkOut: string,                     // "2025-11-18"
  nights: number,                       // 3
  guests: number,                       // 2
  specialRequests: string | null,       // Any special requests
  totalPrice: number,                   // 50000 (in Naira)
  status: string,                       // "HELD"
  timestamp: string                     // ISO 8601 timestamp
}
```

#### 2. **Booking Confirmation**
```typescript
// Event: 'booking-confirmed'
{
  bookingId: string,
  reference: string,
  guestName: string,
  guestPhone: string,
  roomType: string,
  checkIn: string,
  checkOut: string,
  status: "CONFIRMED",
  timestamp: string
}
```

#### 3. **Booking Cancellation**
```typescript
// Event: 'booking-cancelled'
{
  bookingId: string,
  reference: string,
  guestName: string,
  reason: string,                       // Reason for cancellation
  cancelledAt: string,
  timestamp: string
}
```

#### 4. **Order/Booking Status Update**
```typescript
// Event: 'order-status-updated'
{
  bookingId: string,
  reference: string,
  guestName: string,
  previousStatus: string,               // e.g., "CONFIRMED"
  newStatus: string,                    // e.g., "CHECKED_IN"
  updatedAt: string,
  timestamp: string
}
```

#### 5. **Guest Check-In**
```typescript
// Event: 'guest-checked-in'
{
  bookingId: string,
  reference: string,
  guestName: string,
  checkInTime: string,
  roomNumber: string,
  timestamp: string
}
```

## Frontend Integration Guide

### Installation

```bash
npm install socket.io-client
```

### Basic Setup (React Example)

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function RestaurantDashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3001', {
      namespace: '/notifications',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to real-time notifications');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return <div>{/* Your UI */}</div>;
}
```

### Subscribe to Hotel Updates

```typescript
// After connection is established
const subscribeToHotel = (hotelId: string, jwtToken: string) => {
  socket?.emit('subscribe-hotel', {
    hotelId,
    token: jwtToken,
  });

  // Listen for successful subscription
  socket?.on('subscribed', (data) => {
    console.log('✅ Subscribed:', data.message);
  });

  socket?.on('error', (error) => {
    console.error('❌ Subscription error:', error.message);
  });
};

// Call when user logs in
subscribeToHotel('hotel-123', accessToken);
```

### Listen for New Bookings

```typescript
useEffect(() => {
  if (!socket) return;

  // Listen for new orders in real-time
  socket.on('new-order', (orderData) => {
    console.log('🔔 NEW BOOKING RECEIVED!', orderData);
    
    // Update UI immediately
    setNotifications((prev) => [...prev, {
      type: 'new-booking',
      data: orderData,
      receivedAt: new Date(),
    }]);

    // Play sound notification
    playNotificationSound();

    // Show toast/alert
    showAlert(`New booking: ${orderData.guestName}!`);
  });

  return () => {
    socket.off('new-order');
  };
}, [socket]);
```

### Listen for All Events

```typescript
useEffect(() => {
  if (!socket) return;

  // New booking placed
  socket.on('new-order', handleNewOrder);

  // Booking confirmed
  socket.on('booking-confirmed', handleBookingConfirmed);

  // Booking cancelled
  socket.on('booking-cancelled', handleBookingCancelled);

  // Status updated (checked-in, checked-out, etc.)
  socket.on('order-status-updated', handleStatusUpdate);

  // Guest arrived and checked in
  socket.on('guest-checked-in', handleGuestCheckIn);

  return () => {
    socket.off('new-order');
    socket.off('booking-confirmed');
    socket.off('booking-cancelled');
    socket.off('order-status-updated');
    socket.off('guest-checked-in');
  };
}, [socket]);

function handleNewOrder(data: any) {
  console.log('New booking:', data);
  // Update dashboard with new order
}

function handleBookingConfirmed(data: any) {
  console.log('Booking confirmed:', data);
  // Update UI to show confirmed status
}

function handleBookingCancelled(data: any) {
  console.log('Booking cancelled:', data);
  // Update UI to show cancelled status
}

function handleStatusUpdate(data: any) {
  console.log('Status updated:', data);
  // Update booking status in dashboard
}

function handleGuestCheckIn(data: any) {
  console.log('Guest checked in:', data);
  // Show check-in confirmation
}
```

### Unsubscribe from Hotel

```typescript
const unsubscribeFromHotel = (hotelId: string) => {
  socket?.emit('unsubscribe-hotel', { hotelId });
  socket?.on('unsubscribed', (data) => {
    console.log('✅ Unsubscribed from', hotelId);
  });
};
```

### Complete React Component Example

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './hooks/useAuth';
import { useHotel } from './hooks/useHotel';

export function RestaurantDashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { accessToken } = useAuth();
  const { hotelId } = useHotel();

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      namespace: '/notifications',
      auth: { token: accessToken },
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to notifications');
      setIsConnected(true);

      // Subscribe to this hotel's notifications
      newSocket.emit('subscribe-hotel', {
        hotelId,
        token: accessToken,
      });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from notifications');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [hotelId, accessToken]);

  // Listen for new bookings
  useEffect(() => {
    if (!socket) return;

    socket.on('new-order', (data) => {
      console.log('🔔 NEW BOOKING!', data);
      setBookings((prev) => [
        {
          id: data.bookingId,
          reference: data.reference,
          guestName: data.guestName,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          guests: data.guests,
          status: data.status,
          timestamp: data.timestamp,
        },
        ...prev,
      ]);
      setUnreadCount((prev) => prev + 1);
      
      // Optional: Play notification sound
      playSound();
      
      // Optional: Show browser notification
      showBrowserNotification(`New booking from ${data.guestName}!`);
    });

    socket.on('booking-confirmed', (data) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === data.bookingId ? { ...b, status: 'CONFIRMED' } : b
        )
      );
    });

    socket.on('booking-cancelled', (data) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === data.bookingId ? { ...b, status: 'CANCELLED' } : b
        )
      );
    });

    return () => {
      socket.off('new-order');
      socket.off('booking-confirmed');
      socket.off('booking-cancelled');
    };
  }, [socket]);

  return (
    <div className="dashboard">
      <div className="status-bar">
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '✅ Connected' : '⚠️ Disconnected'}
        </div>
        <div className="unread-badge">{unreadCount}</div>
      </div>

      <div className="bookings-list">
        {bookings.map((booking) => (
          <div key={booking.id} className="booking-card">
            <h3>{booking.guestName}</h3>
            <p>Booking: {booking.reference}</p>
            <p>Check-in: {booking.checkIn}</p>
            <p>Guests: {booking.guests}</p>
            <p>Status: {booking.status}</p>
            <small>Received: {new Date(booking.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function playSound() {
  const audio = new Audio('/notification.mp3');
  audio.play().catch(() => console.log('Sound play failed'));
}

function showBrowserNotification(message: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Hotel OS', {
      body: message,
      icon: '/logo.png',
    });
  }
}
```

### Vue 3 Example

```typescript
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

const isConnected = ref(false);
const bookings = ref<any[]>([]);
const hotelId = ref('hotel-123');
const accessToken = ref('your-jwt-token');

let socket: any = null;

onMounted(() => {
  // Connect to WebSocket
  socket = io('http://localhost:3001', {
    namespace: '/notifications',
  });

  socket.on('connect', () => {
    console.log('✅ Connected');
    isConnected.value = true;

    // Subscribe to hotel
    socket.emit('subscribe-hotel', {
      hotelId: hotelId.value,
      token: accessToken.value,
    });
  });

  socket.on('disconnect', () => {
    isConnected.value = false;
  });

  // Listen for new bookings
  socket.on('new-order', (data: any) => {
    bookings.value.unshift({
      id: data.bookingId,
      reference: data.reference,
      guestName: data.guestName,
      status: data.status,
    });
  });

  socket.on('booking-confirmed', (data: any) => {
    const booking = bookings.value.find((b) => b.id === data.bookingId);
    if (booking) booking.status = 'CONFIRMED';
  });
});

onUnmounted(() => {
  if (socket) socket.close();
});
</script>

<template>
  <div class="dashboard">
    <div :class="['status', isConnected ? 'connected' : 'disconnected']">
      {{ isConnected ? '✅ Connected' : '⚠️ Disconnected' }}
    </div>

    <div class="bookings">
      <div v-for="booking in bookings" :key="booking.id" class="booking">
        <h3>{{ booking.guestName }}</h3>
        <p>Ref: {{ booking.reference }}</p>
        <p>Status: {{ booking.status }}</p>
      </div>
    </div>
  </div>
</template>
```

## Testing the WebSocket Connection

### Using WebSocket Test Tool

```bash
# Install wscat for testing
npm install -g wscat

# Connect to the WebSocket
wscat -c ws://localhost:3001/socket.io/?EIO=4&transport=websocket

# In the WebSocket console, emit subscription
> {"type":"event","data":["subscribe-hotel",{"hotelId":"hotel-123","token":"your-jwt-token"}]}
```

### Using curl with Socket.IO

```bash
# The connection will handle the WebSocket upgrade automatically
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:3001/socket.io/?transport=websocket
```

## Features & Capabilities

### ✅ Real-Time Delivery
- Messages delivered instantly to subscribed clients
- No polling or manual refresh needed

### ✅ Automatic Reconnection
- Client automatically reconnects if connection drops
- Reconnection with exponential backoff
- Message queue during disconnection

### ✅ Multi-Hotel Support
- Each hotel staff sees only their hotel's bookings
- Room-based routing (`hotel:${hotelId}`)

### ✅ CORS Enabled
- Supports cross-origin connections
- Secure JWT-based authentication

### ✅ Fallback Transport
- WebSocket primary transport
- HTTP long-polling fallback for older browsers

## Error Handling

```typescript
socket?.on('error', (error) => {
  console.error('Connection error:', error);
  // Handle connection errors
});

socket?.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  // Handle connection errors
});

socket?.on('disconnect', (reason) => {
  console.warn('Disconnected:', reason);
  // Handle disconnection
  // Socket.IO will attempt to reconnect automatically
});
```

## Production Deployment

### Environment Variables

Add to `.env`:
```
WEBSOCKET_URL=https://api.yourdomain.com:443  # Production WebSocket URL
CORS_ORIGIN=https://app.yourdomain.com         # Frontend domain
```

### Server Configuration

```typescript
// In main.ts or app configuration
const io = new IoAdapter(app);
io.configure({
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});
```

### Scaling with Redis Adapter

For multiple server instances:

```bash
npm install @socket.io/redis-adapter redis
```

```typescript
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = createClient();
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

## Browser Support

- ✅ Chrome/Edge 16+
- ✅ Firefox 11+
- ✅ Safari 6+
- ✅ Mobile browsers (iOS Safari, Chrome Android)
- ✅ Internet Explorer 10+ (via long-polling fallback)

## Performance Optimization

1. **Subscription Management**
   - Only subscribe to relevant hotels
   - Unsubscribe when not needed

2. **Event Throttling**
   - Batch rapid updates
   - Debounce UI updates

3. **Memory Management**
   - Limit notification history
   - Clear old messages

4. **Connection Pooling**
   - Reuse socket connections
   - Implement connection sharing across components

## Security

- ✅ JWT token-based authentication
- ✅ CORS validation
- ✅ Secure WebSocket (WSS) for production
- ✅ Message validation and sanitization
- ✅ Rate limiting on subscription events

## Troubleshooting

### Connection Not Establishing

```typescript
// Check connection status
console.log('Connected:', socket.connected);
console.log('Socket ID:', socket.id);

// Check Socket.IO version compatibility
console.log('Engine version:', socket.io.engine.protocol);
```

### Missing Events

```typescript
// Ensure you're subscribed to the correct hotel
socket.emit('subscribe-hotel', { hotelId, token });

// Listen for subscription confirmation
socket.on('subscribed', (data) => console.log('Subscribed:', data));
```

### Browser Notification Permission

```typescript
// Request permission
if ('Notification' in window) {
  Notification.requestPermission().then((permission) => {
    console.log('Notification permission:', permission);
  });
}
```

## Next Steps

1. **Integrate Socket.IO Client** in your frontend application
2. **Test Real-Time Updates** during development
3. **Add Notification UI** (toast, badge, sound)
4. **Deploy** with HTTPS/WSS for production
5. **Monitor** WebSocket connections and performance

## Support & Documentation

- [Socket.IO Documentation](https://socket.io/docs/)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [API Endpoint Docs](./README.md)
