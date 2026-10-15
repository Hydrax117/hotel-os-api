import { IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveDocumentDto {
  @ApiProperty({ example: 'https://your-project.supabase.co/storage/v1/object/public/hotel-documents/hotels/abc123/cac.pdf' })
  @IsUrl()
  url: string;

  @ApiProperty({ example: 'CAC' })
  @IsString()
  documentType: string;

  @ApiProperty({ example: 'Certificate of Incorporation' })
  @IsString()
  label: string;
}
