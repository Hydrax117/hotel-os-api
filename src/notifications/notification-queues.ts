export const NOTIFICATION_QUEUE = 'notifications';
export const SCHEDULED_JOBS_QUEUE = 'scheduled-jobs';

export enum NotificationJobType {
  BOOKING_CONFIRMATION = 'booking.confirmation',
  BOOKING_CANCELLED = 'booking.cancelled',
  CHECK_IN_REMINDER = 'check.in.reminder',
  WELCOME_EMAIL = 'welcome.email',
  HOTEL_APPROVED = 'hotel.approved',
}

export enum ScheduledJobType {
  RELEASE_EXPIRED_HOLDS = 'release.expired.holds',
  CHECK_SUBSCRIPTIONS = 'check.subscriptions',
  SEND_CHECKIN_REMINDERS = 'send.checkin.reminders',
}
