class CalendarService {
  constructor() {
    this.businessHours = {
      start: 12, // 12 PM
      end: 16   // 4 PM
    };
    
    // Store booked slots in memory (in production, use a database)
    this.bookedSlots = new Map();
    
    // Initialize with some sample booked slots for testing
    this.initializeSampleBookings();
  }

  // Initialize with some sample booked slots
  initializeSampleBookings() {
    const today = new Date();
    
    // Book some slots for demonstration
    const sampleBookings = [
      { date: this.formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)).iso, time: '2:00 PM' }, // Tomorrow 2 PM
      { date: this.formatDate(new Date(today.getTime() + 48 * 60 * 60 * 1000)).iso, time: '3:00 PM' }, // Day after tomorrow 3 PM
    ];
    
    sampleBookings.forEach(booking => {
      const slotKey = this.getSlotKey(booking.date, booking.time);
      this.bookedSlots.set(slotKey, {
        bookedAt: new Date().toISOString(),
        meetingId: 'SAMPLE_' + Date.now()
      });
    });
  }

  // Generate available dates (next 7 weekdays) with availability info
  generateAvailableDates(daysAhead = 7) {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= daysAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        const formattedDate = this.formatDate(date);
        const availableSlots = this.getAvailableSlotsForDate(formattedDate.iso);
        const isFullyBooked = availableSlots.length === 0;
        
        dates.push({
          id: `date_${i}`,
          value: formattedDate.iso,
          display: formattedDate.display,
          day: formattedDate.day,
          availableSlots: availableSlots.length,
          isFullyBooked: isFullyBooked,
          availability: isFullyBooked ? '❌ Fully Booked' : `✅ ${availableSlots.length} slots available`
        });
      }
    }
    
    // Filter out fully booked dates and return max 5 dates
    return dates.filter(date => !date.isFullyBooked).slice(0, 5);
  }

  // Generate available times for a specific date
  generateAvailableTimes(selectedDate = null) {
    const times = [];
    
    for (let hour = this.businessHours.start; hour < this.businessHours.end; hour++) {
      const timeString = `${hour}:00`;
      const displayTime = hour >= 12 ? `${hour === 12 ? 12 : hour - 12}:00 PM` : `${hour}:00 AM`;
      
      // Check if this time slot is available for the selected date
      const isAvailable = selectedDate ? this.isSlotAvailable(selectedDate, displayTime) : true;
      
      times.push({
        id: `time_${hour}`,
        value: timeString,
        display: displayTime,
        hour: hour,
        isAvailable: isAvailable,
        availability: isAvailable ? '✅ Available' : '❌ Booked'
      });
    }
    
    return times;
  }

  // Get available slots for a specific date
  getAvailableSlotsForDate(date) {
    const allTimes = this.generateAvailableTimes();
    return allTimes.filter(time => this.isSlotAvailable(date, time.display));
  }

  // Format date to readable format
  formatDate(date) {
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
    
    console.log('📅 Slot booked:', { date, time, meetingId });
    
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
    const availableSlots = [];
    const dates = this.generateAvailableDates(14); // Check next 14 days
    
    for (const date of dates) {
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
}

module.exports = new CalendarService();