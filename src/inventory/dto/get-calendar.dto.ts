import { IsDateString } from 'class-validator';

export class GetCalendarDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
