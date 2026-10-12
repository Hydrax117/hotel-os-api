import { IsInt, Min, Max } from 'class-validator';

export class EnsureInventoryDto {
  @IsInt()
  @Min(1)
  @Max(365)
  days: number;
}
