export const SUBSCRIPTION_PLANS = {
  STARTER: {
    plan: 'STARTER' as const,
    priceNgn: 25000,
    name: 'Starter',
    features: ['Hotel listing', 'Basic dashboard', 'Bookings', 'Inventory'],
  },
  PROFESSIONAL: {
    plan: 'PROFESSIONAL' as const,
    priceNgn: 50000,
    name: 'Professional',
    features: [
      'Everything in Starter',
      'Analytics',
      'Staff accounts',
      'Advanced inventory',
      'Promotions',
    ],
  },
  ENTERPRISE: {
    plan: 'ENTERPRISE' as const,
    priceNgn: 150000,
    name: 'Enterprise',
    features: [
      'Everything in Professional',
      'API integration',
      'Multi-property support',
      'Advanced reporting',
      'Dedicated support',
    ],
  },
} as const;
