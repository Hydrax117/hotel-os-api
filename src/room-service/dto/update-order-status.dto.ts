import { IsEnum } from 'class-validator';
import { ServiceOrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(ServiceOrderStatus) status: ServiceOrderStatus;
}
