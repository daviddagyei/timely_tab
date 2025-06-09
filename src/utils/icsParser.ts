import { ICSEvent, RRule } from '../types';

/**
 * Parses iCal date format to JavaScript Date
 */
export function parseICalDate(value: string): Date {
  console.log('[DEBUG] parseICalDate input:', value);
  
  // Remove any parameters (e.g., VALUE=DATE, TZID, etc.)
  const parts = value.split(';');
  const dateStr = parts[parts.length - 1];
  
  // Remove any prefix like 'VALUE=DATE:'
  const dateValue = dateStr.replace(/^.*:/, '');
  
  let date: Date;
  
  if (dateValue.length === 8) {
    // Date only format: YYYYMMDD
    date = new Date(
      parseInt(dateValue.substring(0, 4), 10),
      parseInt(dateValue.substring(4, 6), 10) - 1, // Month is 0-indexed
      parseInt(dateValue.substring(6, 8), 10)
    );
  } else if (dateValue.length >= 15) {
    // Date-time format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    const cleanValue = dateValue.replace(/Z$/, ''); // Remove trailing Z if present
    date = new Date(
      parseInt(cleanValue.substring(0, 4), 10),
      parseInt(cleanValue.substring(4, 6), 10) - 1,
      parseInt(cleanValue.substring(6, 8), 10),
      parseInt(cleanValue.substring(9, 11), 10),
      parseInt(cleanValue.substring(11, 13), 10),
      parseInt(cleanValue.substring(13, 15), 10) || 0
    );
  } else {
    console.warn('[DEBUG] Unrecognized date format:', dateValue);
    date = new Date();
  }
  
  console.log('[DEBUG] parseICalDate result:', date);
  return date;
}

/**
 * Parses RRULE (recurrence rule) from iCal format
 */
export function parseRRule(value: string): RRule {
  const rrule: RRule = {};
  const rules = value.split(';');
  
  rules.forEach(rule => {
    const [key, val] = rule.split('=');
    if (key && val) {
      rrule[key as keyof RRule] = val;
    }
  });
  
  return rrule;
}

/**
 * Parses ICS (iCalendar) file content and extracts events
 */
export function parseICS(icsContent: string): ICSEvent[] {
  console.log('[DEBUG] parseICS: parsing ICS data');
  console.log('[DEBUG] Raw ICS content length:', icsContent.length);
  
  const events: ICSEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Partial<ICSEvent> | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
      console.log('[DEBUG] Found BEGIN:VEVENT');
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent) {
        events.push(currentEvent as ICSEvent);
        console.log('[DEBUG] Found END:VEVENT, pushed event:', currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      switch (key) {
        case 'SUMMARY':
          currentEvent.summary = value;
          console.log('[DEBUG] SUMMARY =', value);
          break;
        case 'DTSTART':
          try {
            currentEvent.start = parseICalDate(value);
            console.log('[DEBUG] DTSTART =', value, '->', currentEvent.start);
          } catch (error) {
            console.error('[DEBUG] Error parsing DTSTART:', error);
          }
          break;
        case 'DTEND':
          try {
            currentEvent.end = parseICalDate(value);
            console.log('[DEBUG] DTEND =', value, '->', currentEvent.end);
          } catch (error) {
            console.error('[DEBUG] Error parsing DTEND:', error);
          }
          break;
        case 'RRULE':
          currentEvent.rrule = parseRRule(value);
          console.log('[DEBUG] RRULE =', value, '->', currentEvent.rrule);
          break;
        default:
          // Handle other properties as needed
          break;
      }
    }
  }
  
  console.log('[DEBUG] parseICS -> final events array:', events);
  return events;
}
