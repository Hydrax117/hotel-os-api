import {
  IsString,
  IsUrl,
  IsOptional,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddImageDto {
  @ApiProperty({ example: 'https://your-project.supabase.co/storage/v1/object/public/hotel-images/hotels/abc123/photo.jpg' })
  @IsString()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ example: 'Lobby entrance view' })
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
