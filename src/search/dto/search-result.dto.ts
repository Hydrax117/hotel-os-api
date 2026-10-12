export type RoomAvailability = {
  roomTypeId: string;
  name: string;
  bedType: string;
  capacity: number;
  pricePerNight: number;
  availableRooms: number;
  available: boolean;
};

export type HotelSearchResult = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  address: string;
  description: string | null;
  rating: number | null;
  reviewCount: number;
  primaryImageUrl: string | null;
  amenities: string[];
  lowestPrice: number;
  availableRooms: RoomAvailability[];
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
};

export type SearchResponse = {
  hotels: HotelSearchResult[];
  total: number;
  page: number;
  limit: number;
  /** The city filter applied, or null if none. */
  city: string | null;
  checkIn: string | null;
  checkOut: string | null;
};
