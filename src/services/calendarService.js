class CalendarService {
  constructor() {
    this.businessHours = {
      start: 9,  // 9 AM
      end: 17    // 5 PM
    };
    
    // Store booked slots in memory
    this.bookedSlots = new Map();
    
    // Initialize with some sample booked slots for 2025
    this.initializeSampleBookings();
  }

  // Initialize with sample bookings for 2025
  initializeSampleBookings() {
    // Set base date to 2025
    const baseDate = new Date('2025-01-01');
    
    // Book some realistic slots for November 2025
    const sampleBookings = [
      { date: '2025-11-21', time: '2:00 PM' },
      { date: '2025-11-21', time: '3:00 PM' },
      { date: '2025-11-22', time: '10:00 AM' },
      { date: '2025-11-24', time: '11:00 AM' },
    ];
    
    sampleBookings.forEach(booking => {
      const slotKey = this.getSlotKey(booking.date, booking.time);
      this.bookedSlots.set(slotKey, {
        bookedAt: new Date().toISOString(),
        meetingId: 'SAMPLE_' + Date.now()
      });
    });
  }

  // Generate available dates for November 2025
  generateAvailableDates() {
    // Fixed dates for November 2025 with realistic availability
    const november2025Dates = [
      {
        id: 'date_1',
        value: '2025-11-21',
        display: 'Fri, Nov 21, 2025',
        day: 'Friday',
        availableSlots: 3,
        isFullyBooked: false,
        availability: '✅ 3 slots available'
      },
      {
        id: 'date_2',
        value: '2025-11-24',
        display: 'Mon, Nov 24, 2025',
        day: 'Monday',
        availableSlots: 4,
        isFullyBooked: false,
        availability: '✅ 4 slots available'
      },
      {
        id: 'date_3',
        value: '2025-11-25',
        display: 'Tue, Nov 25, 2025',
        day: 'Tuesday',
        availableSlots: 4,
        isFullyBooked: false,
        availability: '✅ 4 slots available'
      },
      {
        id: 'date_4',
        value: '2025-11-26',
        display: 'Wed, Nov 26, 2025',
        day: 'Wednesday',
        availableSlots: 4,
        isFullyBooked: false,
        availability: '✅ 4 slots available'
      },
      {
        id: 'date_5',
        value: '2025-11-27',
        display: 'Thu, Nov 27, 2025',
        day: 'Thursday',
        availableSlots: 4,
        isFullyBooked: false,
        availability: '✅ 4 slots available'
      }
    ];

    return november2025Dates;
  }

  // Generate available times for a specific date in 2025
  generateAvailableTimes(selectedDate = null) {
    const allTimes = [
      { id: 'time_1', value: '09:00', display: '9:00 AM', isAvailable: true },
      { id: 'time_2', value: '10:00', display: '10:00 AM', isAvailable: true },
      { id: 'time_3', value: '11:00', display: '11:00 AM', isAvailable: true },
      { id: 'time_4', value: '12:00', display: '12:00 PM', isAvailable: true },
      { id: 'time_5', value: '13:00', display: '1:00 PM', isAvailable: true },
      { id: 'time_6', value: '14:00', display: '2:00 PM', isAvailable: true },
      { id: 'time_7', value: '15:00', display: '3:00 PM', isAvailable: true },
      { id: 'time_8', value: '16:00', display: '4:00 PM', isAvailable: true }
    ];

    if (!selectedDate) {
      return allTimes;
    }

    // Check availability based on booked slots
    return allTimes.map(time => {
      const isAvailable = this.isSlotAvailable(selectedDate, time.display);
      return {
        ...time,
        isAvailable: isAvailable,
        availability: isAvailable ? '✅ Available' : '❌ Booked'
      };
    });
  }

  // Get available slots for a specific date
  getAvailableSlotsForDate(date) {
    const allTimes = this.generateAvailableTimes(date);
    return allTimes.filter(time => time.isAvailable);
  }

  // Format date to readable format
  formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    };
    
    const display = date.toLocaleDateString('en-US', options);
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    const iso = date.toISOString().split('T')[0];
    
    return {
      display: display,
      day: day,
      iso: iso
    };
  }

  // Check if slot is available
  isSlotAvailable(date, time) {
    const slotKey = this.getSlotKey(date, time);
    return !this.bookedSlots.has(slotKey);
  }

  // Book a slot
  async bookSlot(slotData) {
    const { date, time, meetingId } = slotData;
    const slotKey = this.getSlotKey(date, time);
    
    if (!this.isSlotAvailable(date, time)) {
      return {
        success: false,
        error: 'Slot is already booked',
        slot: { date, time }
      };
    }
    
    // Book the slot
    this.bookedSlots.set(slotKey, {
      bookedAt: new Date().toISOString(),
      meetingId: meetingId || 'MTG_' + Date.now()
    });
    
    console.log('📅 Slot booked for 2025:', { date, time, meetingId });
    
    return {
      success: true,
      bookingId: 'BOOK_' + Date.now(),
      message: 'Slot booked successfully',
      slot: { date, time }
    };
  }

  // Get slot key for storage
  getSlotKey(date, time) {
    return `${date}_${time}`;
  }

  // Get all booked slots (for debugging)
  getBookedSlots() {
    const slots = [];
    for (const [key, value] of this.bookedSlots.entries()) {
      const [date, time] = key.split('_');
      slots.push({
        date,
        time,
        bookedAt: value.bookedAt,
        meetingId: value.meetingId
      });
    }
    return slots;
  }

  // Cancel a booking
  cancelBooking(date, time) {
    const slotKey = this.getSlotKey(date, time);
    const wasBooked = this.bookedSlots.delete(slotKey);
    
    return {
      success: wasBooked,
      message: wasBooked ? 'Booking cancelled' : 'No booking found'
    };
  }

  // Get next available slots
  getNextAvailableSlots(limit = 3) {
    const availableDates = this.generateAvailableDates();
    const availableSlots = [];
    
    for (const date of availableDates) {
      const times = this.getAvailableSlotsForDate(date.value);
      for (const time of times) {
        if (availableSlots.length < limit) {
          availableSlots.push({
            date: date.display,
            time: time.display,
            fullDate: date.value
          });
        }
      }
    }
    
    return availableSlots;
  }

  // DEBUG: Get current calendar state
  getCalendarState() {
    const availableDates = this.generateAvailableDates();
    
    return {
      currentYear: 2025,
      availableDates: availableDates,
      bookedSlots: this.getBookedSlots(),
      businessHours: this.businessHours,
      totalAvailableSlots: availableDates.reduce((sum, date) => sum + date.availableSlots, 0)
    };
  }
}

module.exports = new CalendarService();