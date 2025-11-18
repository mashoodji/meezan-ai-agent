class CalendarService {
  constructor() {
    this.businessHours = {
      start: 12, // 12 PM
      end: 16   // 4 PM
    };
  }

  // Generate available dates (next 7 weekdays)
  generateAvailableDates(daysAhead = 7) {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= daysAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        const formattedDate = this.formatDate(date);
        dates.push({
          id: `date_${i}`,
          value: formattedDate.iso,
          display: formattedDate.display,
          day: formattedDate.day
        });
      }
    }
    
    return dates.slice(0, 5); // Return max 5 dates
  }

  // Generate available times (12 PM - 4 PM)
  generateAvailableTimes() {
    const times = [];
    
    for (let hour = this.businessHours.start; hour < this.businessHours.end; hour++) {
      const timeString = `${hour}:00`;
      const displayTime = hour >= 12 ? `${hour === 12 ? 12 : hour - 12}:00 PM` : `${hour}:00 AM`;
      
      times.push({
        id: `time_${hour}`,
        value: timeString,
        display: displayTime,
        hour: hour
      });
    }
    
    return times;
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
    return true; // In real implementation, check against Google Calendar
  }

  // Book a slot
  async bookSlot(slotData) {
    console.log('📅 Booking slot:', slotData);
    
    return {
      success: true,
      bookingId: 'BOOK_' + Date.now(),
      message: 'Slot booked successfully'
    };
  }
}

module.exports = new CalendarService();