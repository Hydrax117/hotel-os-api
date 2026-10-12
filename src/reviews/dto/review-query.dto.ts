import { IsInt, Min, Max, IsOptional, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ReviewQueryDto {
  @IsInt() @Min(1) @IsOptional() @Type(() => Number) page?: number;
  @IsInt() @Min(1) @Max(50) @IsOptional() @Type(() => Number) limit?: number;
  @IsInt() @Min(1) @Max(5) @IsOptional() @Type(() => Number) minRating?: number;
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  approvedOnly?: boolean;
}
