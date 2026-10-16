import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class InitializePaymentDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;
}
