import {
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  IsPositive,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString() menuItemId: string;
  @IsInt() @IsPositive() @Min(1) quantity: number;
}

export class PlaceOrderDto {
  @IsString() bookingId: string;
  @IsString() venueId: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() roomNumber?: string;
  @IsString() @IsOptional() callbackUrl?: string;
}
