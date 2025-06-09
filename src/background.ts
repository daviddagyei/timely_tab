import { EventData } from './types';
import { StorageHelper } from './utils/storage';

/**
 * Background script for Timely Tab extension
 * Handles alarms, notifications, and event reminders
 */

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed');
});

// Handle alarms for event reminders
chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  console.log('[Background] Alarm triggered:', alarm.name);
  
  if (alarm.name.startsWith('eventReminder')) {
    try {
      const eventInfo = JSON.parse(alarm.name.split('|')[1]) as EventData;
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Event Reminder',
        message: `${eventInfo.title} at ${eventInfo.time}`,
      });
      
      console.log('[Background] Event reminder notification created for:', eventInfo.title);
    } catch (error) {
      console.error('[Background] Error parsing event info from alarm:', error);
    }
  }
});

/**
 * Schedules event reminders based on events data
 */
async function scheduleEventReminders(eventsData: EventData[]): Promise<void> {
  try {
    // Clear all existing alarms first
    await new Promise<void>((resolve) => {
      chrome.alarms.clearAll(() => {
        console.log('[Background] Cleared all existing alarms');
        resolve();
      });
    });

    // Schedule new alarms for each event
    eventsData.forEach((event: EventData) => {
      try {
        const eventDateTime = new Date(`${event.date}T${event.time}`);
        const reminderTime = eventDateTime.getTime() - (10 * 60 * 1000); // 10 minutes before

        if (reminderTime > Date.now()) {
          const alarmName = `eventReminder|${JSON.stringify(event)}`;
          
          chrome.alarms.create(alarmName, {
            when: reminderTime
          });
          
          console.log('[Background] Scheduled reminder for:', event.title, 'at', new Date(reminderTime));
        } else {
          console.log('[Background] Skipping past event:', event.title);
        }
      } catch (error) {
        console.error('[Background] Error scheduling reminder for event:', event, error);
      }
    });
  } catch (error) {
    console.error('[Background] Error in scheduleEventReminders:', error);
  }
}

// Listen for changes in events data
chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
  console.log('[Background] Storage changed in area:', areaName, 'changes:', Object.keys(changes));
  
  if (areaName === 'local' && changes.eventsData) {
    const newEventsData = changes.eventsData.newValue as EventData[] | undefined;
    
    if (newEventsData) {
      console.log('[Background] Events data changed, rescheduling reminders');
      scheduleEventReminders(newEventsData);
    }
  }
});

// Schedule alarms for existing events on startup
(async () => {
  try {
    const result = await StorageHelper.getLocal(['eventsData']);
    const eventsData = result.eventsData || [];
    
    console.log('[Background] Loaded existing events on startup:', eventsData.length);
    await scheduleEventReminders(eventsData);
  } catch (error) {
    console.error('[Background] Error loading events on startup:', error);
  }
})();
