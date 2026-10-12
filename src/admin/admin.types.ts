export type PlatformStats = {
  totalHotels: number;
  activeHotels: number;
  pendingVerifications: number;
  suspendedHotels: number;
  totalBookings: number;
  confirmedBookings: number;
  gmvNgn: number;
  platformRevenueNgn: number;
  totalTravelers: number;
  totalHotelOwners: number;
};

export type RevenueStats = {
  fromDate: string;
  toDate: string;
  totalGmvNgn: number;
  totalCommissionNgn: number;
  bookingCount: number;
  averageBookingValueNgn: number;
  dailyRevenue: { date: string; gmvNgn: number; commissionNgn: number; bookings: number }[];
};
