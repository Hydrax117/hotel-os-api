import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBuildingDto {
  @ApiProperty({ example: 'Main Tower' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'MAIN' })
  @IsString()
  @MinLength(1)
  code: string;
}
