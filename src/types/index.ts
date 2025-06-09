// Type definitions for the Timely Tab Extension

export interface TimetableEntry {
  time: string;
  activity: string;
}

export type TimetableRow = [
  string, // Time label
  string?, // Sunday
  string?, // Monday
  string?, // Tuesday
  string?, // Wednesday
  string?, // Thursday
  string?, // Friday
  string?  // Saturday
];

export type TimetableData = TimetableRow[];

export interface EventData {
  title: string;
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM format
}

export interface TaskData {
  title: string;
}

export interface ThemeColors {
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
}

export type ThemeType = 'light' | 'dark' | 'custom';

export interface StorageData {
  // Timetable data
  timetableData?: TimetableData;
  weekMap?: { [weekKey: string]: TimetableData };
  
  // Settings
  timeIncrement?: string;
  dayStart?: string;
  dayEnd?: string;
  weekStart?: string;
  
  // Theme
  theme?: ThemeType;
  customColors?: ThemeColors;
  
  // Events and tasks
  eventsData?: EventData[];
  tasksData?: TaskData[];
}

export interface ICSEvent {
  summary?: string;
  start?: Date;
  end?: Date;
  rrule?: RRule;
}

export interface RRule {
  [key: string]: string;
}

// DOM Element type guards
export function isHTMLElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement;
}

export function isHTMLInputElement(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

export function isHTMLSelectElement(element: Element | null): element is HTMLSelectElement {
  return element instanceof HTMLSelectElement;
}

export function isHTMLTableElement(element: Element | null): element is HTMLTableElement {
  return element instanceof HTMLTableElement;
}

// Utility types
export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
] as const;

export interface TimeSlot {
  minutes: number;
  label: string;
}

export interface WeekData {
  [weekKey: string]: TimetableData;
}
