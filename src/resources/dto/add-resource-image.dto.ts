import {
  IsString,
  IsUrl,
  IsOptional,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddResourceImageDto {
  @ApiProperty({
    example:
      'https://your-project.supabase.co/storage/v1/object/public/hotel-images/resources/abc123/photo.jpg',
  })
  @IsString()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ example: 'View from the window' })
  @IsString()
  @IsOptional()
  caption?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
