class CalendarService {
  constructor() {
    this.businessHours = {
      start: 9,  // 9 AM
      end: 17    // 5 PM
    };
    
    // Store booked slots in memory
    this.bookedSlots = new Map();
    
    // Working days (Monday to Saturday)
    this.workingDays = [1, 2, 3, 4, 5, 6]; // Monday=1, Sunday=0
    
    // Initialize with some sample booked slots
    this.initializeSampleBookings();
    
    // Preferred meeting times (most popular)
    this.preferredTimes = ['10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM'];
  }

  // Initialize with realistic sample bookings
  initializeSampleBookings() {
    const today = new Date();
    
    // Book some realistic slots for the next few days
    const sampleBookings = [
      { date: this.formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)).iso, time: '2:00 PM' },
      { date: this.formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)).iso, time: '3:00 PM' },
      { date: this.formatDate(new Date(today.getTime() + 48 * 60 * 60 * 1000)).iso, time: '10:00 AM' },
      { date: this.formatDate(new Date(today.getTime() + 72 * 60 * 60 * 1000)).iso, time: '11:00 AM' },
      { date: this.formatDate(new Date(today.getTime() + 96 * 60 * 60 * 1000)).iso, time: '4:00 PM' }
    ];
    
    sampleBookings.forEach(booking => {
      const slotKey = this.getSlotKey(booking.date, booking.time);
      this.bookedSlots.set(slotKey, {
        bookedAt: new Date().toISOString(),
        meetingId: 'SAMPLE_' + Date.now(),
        clientName: 'Sample Client'
      });
    });
    
    console.log('📅 Calendar initialized with sample bookings');
  }

  // Generate available dates (next 7 weekdays)
  generateAvailableDates(daysAhead = 7) {
    const dates = [];
    const today = new Date();
    let daysAdded = 0;
    let currentDate = new Date(today);
    
    // Skip today if it's late in the day
    const currentHour = today.getHours();
    if (currentHour >= 16) { // After 4 PM, start from tomorrow
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    while (daysAdded < daysAhead) {
      // Check if it's a working day
      if (this.isWorkingDay(currentDate)) {
        const formattedDate = this.formatDate(new Date(currentDate));
        const availableSlots = this.getAvailableSlotsForDate(formattedDate.iso);
        const isFullyBooked = availableSlots.length === 0;
        const isToday = this.isSameDay(currentDate, today);
        
        // Calculate availability status
        let availabilityStatus;
        let availabilityIcon;
        
        if (isFullyBooked) {
          availabilityStatus = 'Fully booked';
          availabilityIcon = '❌';
        } else if (availableSlots.length <= 2) {
          availabilityStatus = 'Few slots left';
          availabilityIcon = '⚠️';
        } else if (availableSlots.length <= 4) {
          availabilityStatus = 'Limited availability';
          availabilityIcon = '🟡';
        } else {
          availabilityStatus = 'Good availability';
          availabilityIcon = '✅';
        }
        
        // Add to dates array
        dates.push({
          id: `date_${daysAdded + 1}`,
          value: formattedDate.iso,
          display: formattedDate.display,
          day: formattedDate.day,
          availableSlots: availableSlots.length,
          isFullyBooked: isFullyBooked,
          isToday: isToday,
          isTomorrow: this.isTomorrow(currentDate),
          availability: `${availabilityIcon} ${availableSlots.length} slots (${availabilityStatus})`,
          availabilityStatus: availabilityStatus,
          slots: availableSlots
        });
        daysAdded++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  // Generate available times for a specific date
  generateAvailableTimes(selectedDate = null) {
    const times = [];
    const now = new Date();
    
    // Check if selected date is today
    const isToday = selectedDate ? this.isSameDay(new Date(selectedDate), now) : false;
    const currentHour = now.getHours();
    
    // Generate time slots from 9 AM to 5 PM
    for (let hour = this.businessHours.start; hour < this.businessHours.end; hour++) {
      for (let minute = 0; minute < 60; minute += 60) { // Hourly slots
        // Skip past times if it's today
        if (isToday && hour < currentHour + 1) { // +1 to allow booking at least 1 hour ahead
          continue;
        }
        
        const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = this.formatTime(hour, minute);
        
        // Check if this time slot is available for the selected date
        const isAvailable = selectedDate ? this.isSlotAvailable(selectedDate, displayTime) : true;
        
        // Determine time slot type
        let slotType = 'standard';
        let recommendation = '';
        
        if (this.preferredTimes.includes(displayTime)) {
          slotType = 'preferred';
          recommendation = '🌟 Popular time';
        } else if (hour === 9 || hour === 16) {
          slotType = 'flexible';
          recommendation = '✨ Flexible slot';
        }
        
        if (isAvailable) {
          times.push({
            id: `time_${hour}_${minute}`,
            value: time24,
            display: displayTime,
            hour: hour,
            minute: minute,
            isAvailable: isAvailable,
            slotType: slotType,
            recommendation: recommendation,
            isMorning: hour < 12,
            isAfternoon: hour >= 12 && hour < 15,
            isLateAfternoon: hour >= 15
          });
        }
      }
    }
    
    // Sort times: preferred first, then morning slots, then afternoon
    return times.sort((a, b) => {
      // Preferred slots first
      if (a.slotType === 'preferred' && b.slotType !== 'preferred') return -1;
      if (b.slotType === 'preferred' && a.slotType !== 'preferred') return 1;
      
      // Then by time of day
      if (a.isMorning && !b.isMorning) return -1;
      if (b.isMorning && !a.isMorning) return 1;
      
      // Then by hour
      return a.hour - b.hour;
    });
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
    const { date, time, meetingId, clientName } = slotData;
    const slotKey = this.getSlotKey(date, time);
    
    if (!this.isSlotAvailable(date, time)) {
      return {
        success: false,
        error: 'This time slot is already booked. Please choose another time.',
        slot: { date, time }
      };
    }
    
    // Book the slot
    this.bookedSlots.set(slotKey, {
      bookedAt: new Date().toISOString(),
      meetingId: meetingId || 'MTG_' + Date.now(),
      clientName: clientName || 'Unknown Client'
    });
    
    console.log('📅 Slot booked successfully:', { date, time, meetingId });
    
    return {
      success: true,
      bookingId: 'BOOK_' + Date.now(),
      message: 'Time slot booked successfully! 🎉',
      slot: { date, time },
      meetingId: meetingId || 'MTG_' + Date.now(),
      confirmation: `Your meeting is confirmed for ${date} at ${time}`
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
        meetingId: value.meetingId,
        clientName: value.clientName
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
      message: wasBooked ? 'Booking cancelled successfully' : 'No booking found for this slot'
    };
  }

  // Get next available slots (smart recommendations)
  getNextAvailableSlots(limit = 3) {
    const availableSlots = [];
    const dates = this.generateAvailableDates(10); // Look 10 days ahead
    
    // First, try to find preferred time slots
    for (const date of dates) {
      const times = this.getAvailableSlotsForDate(date.value);
      
      // Check for preferred times first
      for (const preferredTime of this.preferredTimes) {
        const slot = times.find(t => t.display === preferredTime);
        if (slot && availableSlots.length < limit) {
          availableSlots.push({
            date: date.display,
            time: slot.display,
            fullDate: date.value,
            isPreferred: true,
            recommendation: '🌟 Recommended slot'
          });
        }
      }
    }
    
    // If not enough preferred slots, add any available slots
    if (availableSlots.length < limit) {
      for (const date of dates) {
        const times = this.getAvailableSlotsForDate(date.value);
        for (const time of times) {
          // Skip if already added
          if (availableSlots.some(s => s.date === date.display && s.time === time.display)) {
            continue;
          }
          if (availableSlots.length < limit) {
            availableSlots.push({
              date: date.display,
              time: time.display,
              fullDate: date.value,
              isPreferred: false,
              recommendation: '✨ Available slot'
            });
          }
        }
      }
    }
    
    return availableSlots;
  }

  // Get the best available slot (smart selection)
  getBestAvailableSlot() {
    const slots = this.getNextAvailableSlots(1);
    return slots.length > 0 ? slots[0] : null;
  }

  // Check date availability
  checkDateAvailability(date) {
    const availableSlots = this.getAvailableSlotsForDate(date);
    return {
      date: date,
      available: availableSlots.length > 0,
      availableSlots: availableSlots.length,
      slots: availableSlots,
      status: availableSlots.length > 0 ? 'Available' : 'Fully booked'
    };
  }

  // Get calendar summary
  getCalendarSummary() {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const availableDates = this.generateAvailableDates();
    const bookedSlots = this.getBookedSlots();
    const nextAvailable = this.getNextAvailableSlots(3);
    
    return {
      currentDate: today.toISOString().split('T')[0],
      availableDates: availableDates.length,
      bookedAppointments: bookedSlots.length,
      nextAvailableSlots: nextAvailable,
      businessHours: this.businessHours,
      workingDays: this.workingDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
    };
  }

  // Helper methods
  isWorkingDay(date) {
    return this.workingDays.includes(date.getDay());
  }

  isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  isTomorrow(date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.isSameDay(date, tomorrow);
  }

  // DEBUG: Get current calendar state
  getCalendarState() {
    const today = new Date();
    const availableDates = this.generateAvailableDates();
    
    return {
      currentDate: today.toISOString(),
      availableDates: availableDates,
      bookedSlots: Array.from(this.bookedSlots.entries()),
      businessHours: this.businessHours,
      workingDays: this.workingDays,
      preferredTimes: this.preferredTimes
    };
  }
}

module.exports = new CalendarService();