import { IsString, IsNumber, IsOptional, IsBoolean, IsPositive, Min } from 'class-validator';

export class CreateMenuItemDto {
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() category: string;
  @IsNumber() @IsPositive() @Min(1) priceNgn: number;
  @IsBoolean() @IsOptional() isAvailable?: boolean;
  @IsString() @IsOptional() imageUrl?: string;
}
