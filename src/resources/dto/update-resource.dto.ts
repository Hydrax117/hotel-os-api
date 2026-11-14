import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateResourceDto } from './create-resource.dto.js';

// code is not updatable after creation (it's the unique identifier within the hotel)
export class UpdateResourceDto extends PartialType(
  OmitType(CreateResourceDto, ['code', 'resourceCategoryId'] as const),
) {}
