import { 
  TimetableData, 
  EventData, 
  TaskData, 
  ThemeType, 
  DAYS_OF_WEEK,
  isHTMLElement,
  isHTMLInputElement 
} from './types';
import { 
  applyTheme, 
  getThemeColors, 
  getGreeting, 
  isSameDay, 
  initializeEmptyTimetable,
  requireElement 
} from './utils';
import { StorageHelper } from './utils/storage';

/**
 * Popup script for Timely Tab extension
 * Displays today's schedule, upcoming events, and tasks
 */

class PopupManager {
  private greetingEl: HTMLElement;
  private todayList: HTMLElement;
  private upcomingList: HTMLElement;
  private tasksList: HTMLElement;
  private editBtn: HTMLElement;

  constructor() {
    // Get required DOM elements
    this.greetingEl = requireElement(document.getElementById('greeting'), 'greeting');
    this.todayList = requireElement(document.getElementById('today-list'), 'today-list');
    this.upcomingList = requireElement(document.getElementById('upcoming-list'), 'upcoming-list');
    this.tasksList = requireElement(document.getElementById('tasks-list'), 'tasks-list');
    this.editBtn = requireElement(document.getElementById('edit-btn'), 'edit-btn');

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Apply theme preferences
      await this.applyThemePreferences();

      // Display greeting
      this.displayGreeting();

      // Load and display data
      await this.loadAndDisplayData();

      // Set up event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('[Popup] Error during initialization:', error);
    }
  }

  private async applyThemePreferences(): Promise<void> {
    try {
      const result = await StorageHelper.getLocal(['theme', 'customColors']);
      const theme: ThemeType = result.theme || 'light';
      const customColors = result.customColors;
      
      const colors = getThemeColors(theme, customColors);
      applyTheme(colors);
    } catch (error) {
      console.error('[Popup] Error applying theme:', error);
    }
  }

  private displayGreeting(): void {
    const now = new Date();
    const greetingText = getGreeting();
    this.greetingEl.textContent = `${greetingText}! Today is ${now.toDateString()}`;
  }

  private async loadAndDisplayData(): Promise<void> {
    try {
      const result = await StorageHelper.getLocal([
        'weekMap', 
        'weekStart', 
        'timeIncrement', 
        'dayStart', 
        'dayEnd',
        'eventsData', 
        'tasksData'
      ]);

      const timeIncrement = parseInt(result.timeIncrement || '60', 10);
      const dayStart = result.dayStart || '08:00';
      const dayEnd = result.dayEnd || '22:00';
      const eventsData = result.eventsData || [];
      const tasksData = result.tasksData || [];

      // Get current week's timetable data
      let timetableData: TimetableData;
      
      if (result.weekMap && result.weekStart) {
        const currentWeekStart = new Date(result.weekStart);
        const weekKey = currentWeekStart.toISOString().substring(0, 10);
        timetableData = result.weekMap[weekKey] || initializeEmptyTimetable(timeIncrement, dayStart, dayEnd);
      } else {
        // Fallback to legacy single timetable
        timetableData = initializeEmptyTimetable(timeIncrement, dayStart, dayEnd);
      }

      this.displayTodaySchedule(timetableData, eventsData);
      this.displayUpcomingEvents(eventsData);
      this.displayTasks(tasksData);
    } catch (error) {
      console.error('[Popup] Error loading and displaying data:', error);
    }
  }

  private displayTodaySchedule(timetableData: TimetableData, eventsData: EventData[]): void {
    // Clear existing content
    this.todayList.innerHTML = '';

    const todayIndex = new Date().getDay(); // Sunday - Saturday : 0 - 6
    const dayColumnIndex = todayIndex + 1; // +1 because first column is time

    // Display timetable activities for today
    timetableData.forEach(row => {
      const time = row[0];
      const activity = row[dayColumnIndex];
      
      if (activity && activity.trim() !== '') {
        const li = document.createElement('li');
        li.textContent = `${time}: ${activity}`;
        this.todayList.appendChild(li);
      }
    });

    // Include events scheduled for today
    const today = new Date();
    eventsData.forEach(event => {
      try {
        const eventDate = new Date(`${event.date}T${event.time}`);
        
        if (isSameDay(eventDate, today)) {
          const li = document.createElement('li');
          li.textContent = `${event.time}: ${event.title}`;
          this.todayList.appendChild(li);
        }
      } catch (error) {
        console.error('[Popup] Error processing event:', event, error);
      }
    });

    // Show message if no activities for today
    if (this.todayList.children.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No activities scheduled for today';
      li.style.fontStyle = 'italic';
      li.style.color = 'var(--secondary-color)';
      this.todayList.appendChild(li);
    }
  }

  private displayUpcomingEvents(eventsData: EventData[]): void {
    // Clear existing content
    this.upcomingList.innerHTML = '';

    const now = new Date();
    
    // Filter events for the next 7 days
    const upcomingEvents = eventsData.filter(event => {
      try {
        const eventDate = new Date(`${event.date}T${event.time}`);
        const diffTime = eventDate.getTime() - now.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays > 0 && diffDays <= 7;
      } catch (error) {
        console.error('[Popup] Error filtering event:', event, error);
        return false;
      }
    });

    // Sort events by date and time
    upcomingEvents.sort((a, b) => {
      try {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      } catch (error) {
        console.error('[Popup] Error sorting events:', error);
        return 0;
      }
    });

    // Display upcoming events
    upcomingEvents.forEach(event => {
      const li = document.createElement('li');
      li.textContent = `${event.date} ${event.time}: ${event.title}`;
      this.upcomingList.appendChild(li);
    });

    // Show message if no upcoming events
    if (upcomingEvents.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No upcoming events in the next 7 days';
      li.style.fontStyle = 'italic';
      li.style.color = 'var(--secondary-color)';
      this.upcomingList.appendChild(li);
    }
  }

  private displayTasks(tasksData: TaskData[]): void {
    // Clear existing content
    this.tasksList.innerHTML = '';

    // Display tasks
    tasksData.forEach(task => {
      const li = document.createElement('li');
      li.textContent = task.title;
      this.tasksList.appendChild(li);
    });

    // Show message if no tasks
    if (tasksData.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No tasks added';
      li.style.fontStyle = 'italic';
      li.style.color = 'var(--secondary-color)';
      this.tasksList.appendChild(li);
    }
  }

  private setupEventListeners(): void {
    this.editBtn.addEventListener('click', () => {
      // Open the options page to edit the timetable
      chrome.runtime.openOptionsPage();
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Popup] DOM loaded, initializing popup manager');
  new PopupManager();
});
