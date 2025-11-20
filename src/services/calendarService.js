class CalendarService {
  constructor() {
    this.businessHours = {
      start: 9,  // 9 AM
      end: 17    // 5 PM
    };
    
    // Store booked slots in memory
    this.bookedSlots = new Map();
    
    // Initialize with some sample booked slots
    this.initializeSampleBookings();
  }

  // Initialize with realistic sample bookings
  initializeSampleBookings() {
    const today = new Date();
    
    // Book some realistic slots for the next few days
    const sampleBookings = [
      { date: this.formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)).iso, time: '2:00 PM' },
      { date: this.formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)).iso, time: '3:00 PM' },
      { date: this.formatDate(new Date(today.getTime() + 48 * 60 * 60 * 1000)).iso, time: '10:00 AM' },
    ];
    
    sampleBookings.forEach(booking => {
      const slotKey = this.getSlotKey(booking.date, booking.time);
      this.bookedSlots.set(slotKey, {
        bookedAt: new Date().toISOString(),
        meetingId: 'SAMPLE_' + Date.now()
      });
    });
  }

  // Generate available dates (next 7 weekdays)
  generateAvailableDates(daysAhead = 7) {
    const dates = [];
    const today = new Date();
    let daysAdded = 0;
    let currentDate = new Date(today);
    
    while (daysAdded < daysAhead) {
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        const formattedDate = this.formatDate(new Date(currentDate));
        const availableSlots = this.getAvailableSlotsForDate(formattedDate.iso);
        const isFullyBooked = availableSlots.length === 0;
        
        // Only add dates with available slots
        if (!isFullyBooked) {
          dates.push({
            id: `date_${daysAdded + 1}`,
            value: formattedDate.iso,
            display: formattedDate.display,
            day: formattedDate.day,
            availableSlots: availableSlots.length,
            isFullyBooked: isFullyBooked,
            availability: `✅ ${availableSlots.length} slots available`
          });
          daysAdded++;
        }
      }
    }
    
    return dates;
  }

  // Generate available times for a specific date
  generateAvailableTimes(selectedDate = null) {
    const times = [];
    
    // Generate time slots from 9 AM to 5 PM
    for (let hour = this.businessHours.start; hour < this.businessHours.end; hour++) {
      for (let minute = 0; minute < 60; minute += 60) { // Hourly slots
        const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = this.formatTime(hour, minute);
        
        // Check if this time slot is available for the selected date
        const isAvailable = selectedDate ? this.isSlotAvailable(selectedDate, displayTime) : true;
        
        if (isAvailable) {
          times.push({
            id: `time_${hour}_${minute}`,
            value: time24,
            display: displayTime,
            hour: hour,
            minute: minute,
            isAvailable: isAvailable
          });
        }
      }
    }
    
    return times;
  }

  // Format time to 12-hour format
  formatTime(hour, minute) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = minute === 0 ? '00' : minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  }

  // Get available slots for a specific date
  getAvailableSlotsForDate(date) {
    const allTimes = this.generateAvailableTimes(date);
    return allTimes.filter(time => time.isAvailable);
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
    const dates = this.generateAvailableDates(14);
    
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

  // DEBUG: Get current calendar state
  getCalendarState() {
    const today = new Date();
    const availableDates = this.generateAvailableDates();
    
    return {
      currentDate: today.toISOString(),
      availableDates: availableDates,
      bookedSlots: Array.from(this.bookedSlots.entries()),
      businessHours: this.businessHours
    };
  }
}

module.exports = new CalendarService();