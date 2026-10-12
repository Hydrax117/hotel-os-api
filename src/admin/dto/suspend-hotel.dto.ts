import { IsString, IsNotEmpty } from 'class-validator';

export class SuspendHotelDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
