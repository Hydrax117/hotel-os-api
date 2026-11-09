import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ServiceVenueType } from '@prisma/client';

export class CreateVenueDto {
  @IsString() name: string;
  @IsEnum(ServiceVenueType) type: ServiceVenueType;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
