import { PartialType } from '@nestjs/swagger';
import { CreateResourceCategoryDto } from './create-resource-category.dto.js';

export class UpdateResourceCategoryDto extends PartialType(CreateResourceCategoryDto) {}
