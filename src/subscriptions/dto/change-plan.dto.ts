import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class ChangePlanDto {
  @IsEnum(SubscriptionPlan) plan!: SubscriptionPlan;
}
