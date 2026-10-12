import { IsString, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @IsString() bookingId!: string;
  @IsInt() @Min(1) @Max(5) overallRating!: number;
  @IsInt() @Min(1) @Max(5) cleanlinessRating!: number;
  @IsInt() @Min(1) @Max(5) locationRating!: number;
  @IsInt() @Min(1) @Max(5) serviceRating!: number;
  @IsInt() @Min(1) @Max(5) valueRating!: number;
  @IsInt() @Min(1) @Max(5) facilitiesRating!: number;
  @IsString() @MinLength(5) @MaxLength(100) title!: string;
  @IsString() @MinLength(50) @MaxLength(2000) body!: string;
}
