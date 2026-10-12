import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service.js';
import { SearchHotelsDto } from './dto/search-hotels.dto.js';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Search hotels with optional availability filtering.
   * When checkIn + checkOut are provided, only hotels with at least one
   * available room for the selected dates are returned.
   */
  @Get('hotels')
  @ApiOperation({
    summary: 'Search hotels',
    description:
      'Search approved, published hotels by city/state/name. ' +
      'Supply checkIn + checkOut to filter by real availability.',
  })
  searchHotels(@Query() dto: SearchHotelsDto) {
    return this.searchService.searchHotels(dto);
  }

  /**
   * Get popular cities ranked by hotel count.
   */
  @Get('popular-cities')
  @ApiOperation({ summary: 'Get cities with the most approved hotels' })
  getPopularCities() {
    return this.searchService.getPopularCities();
  }

  /**
   * Get featured hotels (highest review count).
   */
  @Get('featured')
  @ApiOperation({ summary: 'Get featured hotels' })
  getFeatured(@Query('limit') limit?: string) {
    return this.searchService.getFeaturedHotels(limit ? Number(limit) : 8);
  }

  /**
   * Get full detail for a single hotel by id or slug.
   */
  @Get('hotels/:idOrSlug')
  @ApiOperation({ summary: 'Get hotel detail by id or slug' })
  @ApiParam({ name: 'idOrSlug', description: 'Hotel id or slug' })
  getHotelDetail(
    @Param('idOrSlug') idOrSlug: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkOut') checkOut?: string,
    @Query('guests') guests?: string,
  ) {
    return this.searchService.getHotelDetail(
      idOrSlug,
      checkIn,
      checkOut,
      guests ? Number(guests) : undefined,
    );
  }
}
