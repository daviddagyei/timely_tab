// background.js

chrome.runtime.onInstalled.addListener(() => {
  // Initialize any data if needed
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('eventReminder')) {
    const eventInfo = JSON.parse(alarm.name.split('|')[1]);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Event Reminder',
      message: `${eventInfo.title} at ${eventInfo.time}`,
    });
  }
});

// Function to schedule event reminders
function scheduleEventReminders(eventsData) {
  chrome.alarms.clearAll(() => {
    eventsData.forEach(event => {
      const eventDateTime = new Date(`${event.date}T${event.time}`);
      const reminderTime = eventDateTime.getTime() - (10 * 60 * 1000); // 10 minutes before

      if (reminderTime > Date.now()) {
        chrome.alarms.create(`eventReminder|${JSON.stringify(event)}`, {
          when: reminderTime
        });
      }
    });
  });
}

// Listen for changes in eventsData
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.eventsData) {
    const newEventsData = changes.eventsData.newValue;
    scheduleEventReminders(newEventsData);
  }
});

// On startup, schedule alarms for existing events
chrome.storage.sync.get(['eventsData'], (result) => {
  const eventsData = result.eventsData || [];
  scheduleEventReminders(eventsData);
});
