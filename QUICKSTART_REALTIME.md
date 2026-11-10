# Quick Start: Real-Time Notifications in 5 Minutes

## Installation

```bash
npm install socket.io-client
```

## Copy-Paste Code

### React Component

```typescript
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function BookingNotifications() {
  const [bookings, setBookings] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // 1. Connect to WebSocket
    const socket = io('http://localhost:3001', {
      namespace: '/notifications',
    });

    // 2. Listen for connection
    socket.on('connect', () => {
      console.log('✅ Connected!');
      setConnected(true);

      // 3. Subscribe to your hotel
      socket.emit('subscribe-hotel', {
        hotelId: 'YOUR_HOTEL_ID_HERE',
        token: 'YOUR_JWT_TOKEN_HERE',
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // 4. Listen for new bookings
    socket.on('new-order', (data) => {
      console.log('🔔 NEW BOOKING!', data);
      setBookings(prev => [
        {
          id: data.bookingId,
          reference: data.reference,
          guest: data.guestName,
          phone: data.guestPhone,
          email: data.guestEmail,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          guests: data.guests,
          room: data.roomType,
          notes: data.specialRequests,
          price: data.totalPrice,
          time: new Date(),
        },
        ...prev
      ]);
    });

    socket.on('booking-confirmed', (data) => {
      setBookings(prev =>
        prev.map(b =>
          b.id === data.bookingId ? { ...b, status: 'CONFIRMED' } : b
        )
      );
    });

    socket.on('booking-cancelled', (data) => {
      setBookings(prev =>
        prev.map(b =>
          b.id === data.bookingId ? { ...b, status: 'CANCELLED' } : b
        )
      );
    });

    return () => socket.close();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>📋 Bookings Dashboard</h2>
      
      <div style={{
        padding: '10px',
        marginBottom: '20px',
        backgroundColor: connected ? '#d4edda' : '#f8d7da',
        borderRadius: '5px',
        color: connected ? '#155724' : '#721c24',
      }}>
        {connected ? '✅ Connected - Receiving Live Updates' : '⚠️ Disconnected'}
      </div>

      <div style={{ fontSize: '24px', marginBottom: '20px', fontWeight: 'bold' }}>
        📦 {bookings.length} Bookings
      </div>

      {bookings.length === 0 ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#999',
          fontSize: '16px',
        }}>
          Waiting for bookings... 🕐
        </div>
      ) : (
        <div>
          {bookings.map(booking => (
            <div
              key={booking.id}
              style={{
                padding: '15px',
                marginBottom: '10px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0' }}>
                    {booking.guest} 
                    <span style={{ fontSize: '12px', color: '#999', marginLeft: '10px' }}>
                      {booking.reference}
                    </span>
                  </h3>
                  <p style={{ margin: '5px 0', color: '#666' }}>
                    📱 {booking.phone} | 📧 {booking.email}
                  </p>
                  <p style={{ margin: '5px 0', color: '#666' }}>
                    🏨 {booking.room} • 👥 {booking.guests} guests
                  </p>
                  <p style={{ margin: '5px 0', color: '#666' }}>
                    📅 {booking.checkIn} → {booking.checkOut}
                  </p>
                  {booking.notes && (
                    <p style={{ margin: '5px 0', color: '#999', fontStyle: 'italic' }}>
                      📝 {booking.notes}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                    ₦{booking.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
                    {booking.time.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Vue 3 Component

```vue
<template>
  <div class="dashboard">
    <h2>📋 Bookings Dashboard</h2>
    
    <div :class="['status', isConnected ? 'connected' : 'disconnected']">
      {{ isConnected ? '✅ Connected' : '⚠️ Disconnected' }}
    </div>

    <div class="count">📦 {{ bookings.length }} Bookings</div>

    <div v-if="bookings.length === 0" class="empty">
      Waiting for bookings... 🕐
    </div>

    <div v-else class="bookings">
      <div v-for="booking in bookings" :key="booking.id" class="booking-card">
        <div class="booking-header">
          <h3>{{ booking.guest }} <span class="ref">{{ booking.reference }}</span></h3>
        </div>
        <p>📱 {{ booking.phone }} | 📧 {{ booking.email }}</p>
        <p>🏨 {{ booking.room }} • 👥 {{ booking.guests }} guests</p>
        <p>📅 {{ booking.checkIn }} → {{ booking.checkOut }}</p>
        <p v-if="booking.notes" class="notes">📝 {{ booking.notes }}</p>
        <div class="footer">
          <span class="price">₦{{ booking.price.toLocaleString() }}</span>
          <span class="time">{{ formatTime(booking.time) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

const isConnected = ref(false);
const bookings = ref<any[]>([]);
let socket: any = null;

const formatTime = (date: Date) => date.toLocaleTimeString();

onMounted(() => {
  socket = io('http://localhost:3001', {
    namespace: '/notifications',
  });

  socket.on('connect', () => {
    isConnected.value = true;
    console.log('✅ Connected!');
    
    // Subscribe to hotel
    socket.emit('subscribe-hotel', {
      hotelId: 'YOUR_HOTEL_ID_HERE',
      token: 'YOUR_JWT_TOKEN_HERE',
    });
  });

  socket.on('disconnect', () => {
    isConnected.value = false;
  });

  socket.on('new-order', (data: any) => {
    bookings.value.unshift({
      id: data.bookingId,
      reference: data.reference,
      guest: data.guestName,
      phone: data.guestPhone,
      email: data.guestEmail,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guests: data.guests,
      room: data.roomType,
      notes: data.specialRequests,
      price: data.totalPrice,
      time: new Date(),
    });
  });

  socket.on('booking-confirmed', (data: any) => {
    const booking = bookings.value.find(b => b.id === data.bookingId);
    if (booking) booking.status = 'CONFIRMED';
  });

  socket.on('booking-cancelled', (data: any) => {
    const booking = bookings.value.find(b => b.id === data.bookingId);
    if (booking) booking.status = 'CANCELLED';
  });
});

onUnmounted(() => {
  if (socket) socket.close();
});
</script>

<style scoped>
.dashboard {
  padding: 20px;
  font-family: Arial, sans-serif;
  max-width: 1000px;
  margin: 0 auto;
}

h2 {
  margin: 0 0 20px 0;
}

.status {
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 5px;
  font-weight: bold;
}

.status.connected {
  background-color: #d4edda;
  color: #155724;
}

.status.disconnected {
  background-color: #f8d7da;
  color: #721c24;
}

.count {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
}

.empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 16px;
}

.bookings {
  display: grid;
  gap: 10px;
}

.booking-card {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.booking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.booking-header h3 {
  margin: 0;
}

.ref {
  font-size: 12px;
  color: #999;
  margin-left: 10px;
}

.notes {
  font-style: italic;
  color: #999;
}

.footer {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.price {
  font-size: 18px;
  font-weight: bold;
  color: #28a745;
}

.time {
  font-size: 12px;
  color: #999;
}

p {
  margin: 5px 0;
  color: #666;
}
</style>
```

## Configuration

Replace these values:

```javascript
hotelId: 'YOUR_HOTEL_ID_HERE'        // Your hotel's ID from database
token: 'YOUR_JWT_TOKEN_HERE'         // User's JWT access token
```

How to get them:

1. **Hotel ID** - When you create a hotel, you get an ID back
2. **JWT Token** - After user logs in, you get an `accessToken`

Example:
```javascript
// After login
const response = await fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'owner@hotel.com',
    password: 'password123',
  })
});

const data = await response.json();
const jwtToken = data.accessToken;  // Use this!
const hotelId = data.user.hotelId;  // Use this!
```

## Server Endpoint

The WebSocket server is running at:
```
ws://localhost:3001/socket.io/?transport=websocket
```

For production, use WSS (secure):
```
wss://api.yourdomain.com/socket.io/
```

## Test It

1. **Start the server**:
   ```bash
   npm run start:dev
   ```

2. **Add the component to your app**
   
3. **Place a booking** via the API:
   ```bash
   curl -X POST http://localhost:3001/bookings \
     -H "Authorization: Bearer JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "hotelId": "hotel-123",
       "roomTypeId": "room-type-456",
       "checkIn": "2025-11-15",
       "checkOut": "2025-11-18",
       "guests": 2,
       "guestFirstName": "John",
       "guestLastName": "Doe",
       "guestEmail": "john@example.com",
       "guestPhone": "+1234567890",
       "totalPrice": 75000
     }'
   ```

4. **Watch it appear in real-time** - No refresh needed! 🎉

## Events You'll Receive

- `new-order` - New booking placed
- `booking-confirmed` - Guest confirms payment
- `booking-cancelled` - Booking cancelled
- `order-status-updated` - Check-in/check-out/no-show
- `guest-checked-in` - Guest arrived

## Add Notifications

### Sound Notification

```javascript
function playSound() {
  const audio = new Audio('/notification.mp3');
  audio.play();
}

socket.on('new-order', (data) => {
  playSound();  // 🔔
  setBookings(prev => [data, ...prev]);
});
```

### Browser Notification

```javascript
// Ask permission first
if ('Notification' in window) {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      socket.on('new-order', (data) => {
        new Notification(`New booking from ${data.guestName}!`, {
          body: `Check-in: ${data.checkIn}`,
          icon: '/logo.png',
        });
      });
    }
  });
}
```

### Toast Notification

```javascript
// Using a library like react-toastify
import { toast } from 'react-toastify';

socket.on('new-order', (data) => {
  toast.success(`✅ New booking: ${data.guestName}!`);
});
```

## Done! 🎉

Your restaurant staff now get instant notifications!

**Next Steps:**
- Deploy to production (use WSS)
- Add UI components for your design
- Configure authentication properly
- Set up error handling
- Add analytics/logging

See `REALTIME_NOTIFICATIONS.md` for advanced features and troubleshooting.
