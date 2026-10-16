import {
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApplicationImageDto {
  @IsString()
  url!: string;

  @IsString()
  @IsOptional()
  caption?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class ApplicationDocumentDto {
  @IsString()
  url!: string;

  @IsString()
  documentType!: string;

  @IsString()
  label!: string;
}

export class ApplicationRoomDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  bedType!: string;

  @IsNumber()
  capacity!: number;

  @IsNumber()
  pricePerNight!: number;

  @IsNumber()
  totalRooms!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  sizeSqm?: number;

  @IsString()
  @IsOptional()
  bathroomType?: string;
}

export class CreateApplicationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  address!: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  checkInTime?: string;

  @IsString()
  @IsOptional()
  checkOutTime?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenityIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationImageDto)
  images!: ApplicationImageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationDocumentDto)
  documents!: ApplicationDocumentDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApplicationRoomDto)
  rooms!: ApplicationRoomDto[];
}
