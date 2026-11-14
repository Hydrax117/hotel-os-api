import { IsString, IsInt, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFloorDto {
  @ApiProperty({ example: 'Ground Floor' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  levelNumber: number;
}
