import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsEnum(SubscriptionPlan) plan!: SubscriptionPlan;
}
