import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface SubscribedHotel {
  hotelId: string;
  userId: string; // Hotel owner ID
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notifications',
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Track which hotels each user is subscribed to
  private userSubscriptions = new Map<string, Set<string>>(); // userId -> Set<hotelId>
  private hotelSockets = new Map<string, Set<string>>(); // hotelId -> Set<socketIds>

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up subscriptions when user disconnects
    for (const [hotelId, sockets] of this.hotelSockets) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.hotelSockets.delete(hotelId);
        }
      }
    }
  }

  /**
   * Guest: join a user-scoped room to receive personal notifications.
   * Client sends: { userId } — server validates nothing (guests are authenticated
   * via JwtAuthGuard on HTTP, so we trust this is the right user for now;
   * a production hardening pass would verify a short-lived token here too).
   */
  @SubscribeMessage('join-user')
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (!data.userId) return;
    void client.join(`user:${data.userId}`);
    client.emit('joined-user', { room: `user:${data.userId}` });
    this.logger.log(`Client ${client.id} joined user:${data.userId}`);
  }

  /**
   * Fallback join without JWT (used when no token is available yet).
   * Client sends: { hotelId }
   */
  @SubscribeMessage('join-hotel')
  handleJoinHotel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { hotelId: string },
  ) {
    void client.join(`hotel:${data.hotelId}`);
    client.emit('joined', { room: `hotel:${data.hotelId}` });
    this.logger.log(`Client ${client.id} joined hotel:${data.hotelId} (unauthenticated)`);
  }

  /**
   * Subscribe to real-time updates for a specific hotel
   * Client sends: { hotelId, token }
   */
  @SubscribeMessage('subscribe-hotel')
  handleSubscribeHotel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { hotelId: string; token: string },
  ) {
    try {
      const payload = this.jwtService.verify(data.token);
      const userId = payload.sub;

      // Store subscription
      if (!this.userSubscriptions.has(userId)) {
        this.userSubscriptions.set(userId, new Set());
      }
      const userHotels = this.userSubscriptions.get(userId);
      if (userHotels) {
        userHotels.add(data.hotelId);
      }

      if (!this.hotelSockets.has(data.hotelId)) {
        this.hotelSockets.set(data.hotelId, new Set());
      }
      const hotelClients = this.hotelSockets.get(data.hotelId);
      if (hotelClients) {
        hotelClients.add(client.id);
      }

      // Join Socket.IO room for the hotel
      client.join(`hotel:${data.hotelId}`);

      client.emit('subscribed', {
        hotelId: data.hotelId,
        message: `Successfully subscribed to hotel ${data.hotelId}`,
      });

      this.logger.log(
        `User ${userId} subscribed to hotel ${data.hotelId}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      client.emit('error', { message: 'Invalid token or subscription failed' });
      this.logger.error(`Subscription error: ${errorMessage}`);
    }
  }

  /**
   * Unsubscribe from hotel updates
   */
  @SubscribeMessage('unsubscribe-hotel')
  handleUnsubscribeHotel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { hotelId: string },
  ) {
    client.leave(`hotel:${data.hotelId}`);

    const hotelClients = this.hotelSockets.get(data.hotelId);
    if (hotelClients) {
      hotelClients.delete(client.id);
      if (hotelClients.size === 0) {
        this.hotelSockets.delete(data.hotelId);
      }
    }

    client.emit('unsubscribed', { hotelId: data.hotelId });
    this.logger.log(`Client ${client.id} unsubscribed from hotel ${data.hotelId}`);
  }

  /**
   * Broadcast new order to all connected restaurant staff for that hotel
   */
  notifyNewOrder(hotelId: string, orderData: any) {
    this.server.to(`hotel:${hotelId}`).emit('new-order', {
      timestamp: new Date().toISOString(),
      ...orderData,
    });

    this.logger.log(
      `[REALTIME] Notified ${this.hotelSockets.get(hotelId)?.size || 0} staff members about new order in hotel ${hotelId}`,
    );
  }

  /**
   * Broadcast order status update — to hotel staff room AND the guest's user room.
   * Pass guestUserId so the guest receives the notification wherever they are.
   */
  notifyOrderStatusUpdate(hotelId: string, orderData: Record<string, unknown>, guestUserId?: string) {
    const payload = { timestamp: new Date().toISOString(), ...orderData };
    // Hotel staff
    this.server.to(`hotel:${hotelId}`).emit('order-status-updated', payload);
    // Guest — emit to user-scoped room if userId is known
    if (guestUserId) {
      this.server.to(`user:${guestUserId}`).emit('order-status-updated', payload);
    }
    this.logger.log(`[REALTIME] Order status updated for hotel ${hotelId}${guestUserId ? ` / user ${guestUserId}` : ''}`);
  }

  /**
   * Broadcast booking confirmation to restaurant
   */
  notifyBookingConfirmed(hotelId: string, bookingData: any) {
    this.server.to(`hotel:${hotelId}`).emit('booking-confirmed', {
      timestamp: new Date().toISOString(),
      ...bookingData,
    });

    this.logger.log(`[REALTIME] Booking confirmed notification sent to hotel ${hotelId}`);
  }

  /**
   * Broadcast booking cancellation to restaurant
   */
  notifyBookingCancelled(hotelId: string, bookingData: any) {
    this.server.to(`hotel:${hotelId}`).emit('booking-cancelled', {
      timestamp: new Date().toISOString(),
      ...bookingData,
    });

    this.logger.log(`[REALTIME] Booking cancellation notification sent to hotel ${hotelId}`);
  }

  /**
   * Broadcast guest check-in to restaurant
   */
  notifyGuestCheckIn(hotelId: string, checkInData: any) {
    this.server.to(`hotel:${hotelId}`).emit('guest-checked-in', {
      timestamp: new Date().toISOString(),
      ...checkInData,
    });

    this.logger.log(`[REALTIME] Guest check-in notification sent to hotel ${hotelId}`);
  }

  /**
   * Get count of connected staff members for a hotel
   */
  getConnectedStaffCount(hotelId: string): number {
    return this.hotelSockets.get(hotelId)?.size || 0;
  }

  /**
   * Get all hotel IDs with connected clients
   */
  getActiveHotels(): string[] {
    return Array.from(this.hotelSockets.keys());
  }
}
