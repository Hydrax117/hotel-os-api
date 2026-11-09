import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * WebSocket gateway for real-time room service events.
 *
 * Connection flow:
 *   1. Client connects and emits `join-hotel` with { hotelId, token }
 *   2. Gateway adds the socket to room `hotel:<hotelId>`
 *   3. When a new order is placed/updated, the service calls
 *      gateway.emitNewOrder / gateway.emitOrderUpdate — all sockets in
 *      that room receive the event immediately.
 *
 * Events emitted to clients:
 *   `new-order`      – full order payload when a guest pays and order is confirmed
 *   `order-updated`  – { orderId, status } when hotel staff update an order status
 */
@WebSocketGateway({
  cors: {
    origin: '*', // CORS handled at the HTTP layer; WS just needs to accept
    credentials: true,
  },
  namespace: '/room-service',
})
export class RoomServiceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoomServiceGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`WS connect: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnect: ${client.id}`);
  }

  /**
   * Client joins the hotel-specific room so it receives that hotel's events only.
   * Payload: { hotelId: string }
   * No token validation here — the room is only useful for reading, and the
   * actual data-write actions all go through guarded HTTP endpoints.
   */
  @SubscribeMessage('join-hotel')
  handleJoinHotel(
    @MessageBody() data: { hotelId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `hotel:${data.hotelId}`;
    void client.join(room);
    this.logger.log(`Socket ${client.id} joined ${room}`);
    client.emit('joined', { room });
  }

  @SubscribeMessage('leave-hotel')
  handleLeaveHotel(
    @MessageBody() data: { hotelId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `hotel:${data.hotelId}`;
    void client.leave(room);
  }

  // ── Called by RoomServiceService ─────────────────────────────────────────

  /** Broadcast a new confirmed order to all hotel dashboard clients */
  emitNewOrder(hotelId: string, order: unknown) {
    this.server.to(`hotel:${hotelId}`).emit('new-order', order);
  }

  /** Broadcast an order status change */
  emitOrderUpdate(hotelId: string, payload: { orderId: string; status: string }) {
    this.server.to(`hotel:${hotelId}`).emit('order-updated', payload);
  }
}
