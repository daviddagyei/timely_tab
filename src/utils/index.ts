import { ThemeColors, ThemeType, DayOfWeek, DAYS_OF_WEEK, TimetableData, TimetableRow } from '../types';

/**
 * Shows a notification to the user
 */
export function showNotification(message: string): void {
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.classList.remove('hide');
    
    setTimeout(() => {
      notification.classList.add('hide');
    }, 3000);
  }
}

/**
 * Gets the start of the week (Sunday) for a given date
 */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  result.setDate(result.getDate() - dayOfWeek);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Generates a week key for storage (YYYY-MM-DD format of the Sunday)
 */
export function getWeekKey(dateObj: Date): string {
  return dateObj.toISOString().substring(0, 10);
}

/**
 * Parses a time string (HH:MM) to minutes since midnight
 */
export function parseTimeStr(timeStr: string): number {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Converts minutes since midnight to time string (HH:MM)
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Applies theme colors to the document
 */
export function applyTheme(colors: ThemeColors): void {
  document.documentElement.style.setProperty('--background-color', colors.backgroundColor);
  document.documentElement.style.setProperty('--text-color', colors.textColor);
  document.documentElement.style.setProperty('--primary-color', colors.primaryColor);
  document.documentElement.style.setProperty('--secondary-color', colors.secondaryColor);
  document.documentElement.style.setProperty('--border-color', colors.borderColor);
}

/**
 * Gets theme colors for a given theme type
 */
export function getThemeColors(theme: ThemeType, customColors?: ThemeColors): ThemeColors {
  if (theme === 'custom' && customColors) {
    return customColors;
  }
  
  if (theme === 'dark') {
    return {
      backgroundColor: '#121212',
      textColor: '#ffffff',
      primaryColor: '#bb86fc',
      secondaryColor: '#03dac6',
      borderColor: '#333333'
    };
  }
  
  // Light theme (default)
  return {
    backgroundColor: '#ffffff',
    textColor: '#000000',
    primaryColor: '#4CAF50',
    secondaryColor: '#6c757d',
    borderColor: '#dddddd'
  };
}

/**
 * Checks if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Generates time slots for a given time range and increment
 */
export function getTimeSlots(startStr: string, endStr: string, increment: number): number[] {
  const startMinutes = parseTimeStr(startStr);
  let endMinutes = parseTimeStr(endStr);
  
  // Handle cross-midnight scenarios
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  
  const timeSlots: number[] = [];
  for (let time = startMinutes; time <= endMinutes; time += increment) {
    timeSlots.push(time);
  }
  
  return timeSlots;
}

/**
 * Formats a time in minutes to display format (12-hour with AM/PM)
 */
export function formatTimeDisplay(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const displayHour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${displayHour}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Creates an empty timetable with the specified configuration
 */
export function initializeEmptyTimetable(
  timeIncrement: number,
  dayStart: string,
  dayEnd: string
): TimetableData {
  const data: TimetableData = [];
  const timeSlots = getTimeSlots(dayStart, dayEnd, timeIncrement);
  
  timeSlots.forEach(timeMinutes => {
    const timeLabel = formatTimeDisplay(timeMinutes);
    const row: TimetableRow = [timeLabel];
    
    // Add empty cells for each day of the week
    for (let i = 0; i < DAYS_OF_WEEK.length; i++) {
      row.push('');
    }
    
    data.push(row);
  });
  
  return data;
}

/**
 * Gets the current greeting based on time of day
 */
export function getGreeting(): string {
  const hours = new Date().getHours();
  
  if (hours < 12) {
    return 'Good Morning';
  } else if (hours < 18) {
    return 'Good Afternoon';
  } else {
    return 'Good Evening';
  }
}

/**
 * Maps iCal day codes to day names
 */
export function iCalDayToWeekday(dayCode: string): DayOfWeek | null {
  const mapping: { [key: string]: DayOfWeek } = {
    'SU': 'Sunday',
    'MO': 'Monday',
    'TU': 'Tuesday',
    'WE': 'Wednesday',
    'TH': 'Thursday',
    'FR': 'Friday',
    'SA': 'Saturday',
  };
  return mapping[dayCode] || null;
}

/**
 * Validates that an element exists and throws an error if not
 */
export function requireElement<T extends Element>(element: T | null, id: string): T {
  if (!element) {
    throw new Error(`Required element with id "${id}" not found`);
  }
  return element;
}
