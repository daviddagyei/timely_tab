// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const greetingEl = document.getElementById('greeting');
  const todayList = document.getElementById('today-list');
  const upcomingList = document.getElementById('upcoming-list');
  const tasksList = document.getElementById('tasks-list');
  const editBtn = document.getElementById('edit-btn');

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /*** Apply Theme Preferences ***/
  chrome.storage.sync.get(['theme', 'customColors'], (result) => {
    const theme = result.theme || 'light';
    const colors = theme === 'custom' ? result.customColors : getThemeColors(theme);
    applyTheme(colors);
  });

  function applyTheme(colors) {
    document.documentElement.style.setProperty('--background-color', colors.backgroundColor);
    document.documentElement.style.setProperty('--text-color', colors.textColor);
    document.documentElement.style.setProperty('--primary-color', colors.primaryColor);
    document.documentElement.style.setProperty('--secondary-color', colors.secondaryColor);
    document.documentElement.style.setProperty('--border-color', colors.borderColor);
  }

  function getThemeColors(theme) {
    if (theme === 'dark') {
      return {
        backgroundColor: '#121212',
        textColor: '#ffffff',
        primaryColor: '#bb86fc',
        secondaryColor: '#03dac6',
        borderColor: '#333333'
      };
    } else {
      // Light theme or default
      return {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        primaryColor: '#4CAF50',
        secondaryColor: '#6c757d',
        borderColor: '#dddddd'
      };
    }
  }

  // Display Greeting
  displayGreeting();

  // Load and Display Data
  loadAndDisplayData();

  editBtn.addEventListener('click', () => {
    // Open the options page to edit the timetable
    chrome.runtime.openOptionsPage();
  });

  function displayGreeting() {
    const now = new Date();
    const hours = now.getHours();
    let greetingText = 'Hello';

    if (hours < 12) {
      greetingText = 'Good Morning';
    } else if (hours < 18) {
      greetingText = 'Good Afternoon';
    } else {
      greetingText = 'Good Evening';
    }

    greetingEl.textContent = `${greetingText}! Today is ${now.toDateString()}`;
  }

  function loadAndDisplayData() {
    chrome.storage.sync.get(['timetableData', 'timeIncrement', 'eventsData', 'tasksData'], (result) => {
      const timeIncrement = parseInt(result.timeIncrement) || 60;
      const timetableData = result.timetableData || initializeEmptyTimetable(timeIncrement);
      const eventsData = result.eventsData || [];
      const tasksData = result.tasksData || [];

      displayTodaySchedule(timetableData, eventsData);
      displayUpcomingEvents(eventsData);
      displayTasks(tasksData);
    });
  }

  function initializeEmptyTimetable(timeIncrement) {
    const data = [];
    const startTime = 0 * 60; // 8 AM in minutes
    const endTime = 23 * 60;  // 10 PM in minutes

    for (let time = startTime; time <= endTime; time += timeIncrement) {
      const hour = Math.floor(time / 60);
      const minutes = time % 60;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const timeLabel = `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      const row = [timeLabel];
      for (let i = 0; i < days.length; i++) {
        row.push('');
      }
      data.push(row);
    }
    return data;
  }

  function displayTodaySchedule(timetableData, eventsData) {
    const todayIndex = new Date().getDay(); // Sunday - Saturday : 0 - 6
    const dayColumnIndex = todayIndex + 1; // +1 because first column is time

    timetableData.forEach(row => {
      const time = row[0];
      const activity = row[dayColumnIndex];
      if (activity) {
        const li = document.createElement('li');
        li.textContent = `${time}: ${activity}`;
        todayList.appendChild(li);
      }
    });

    // Include events scheduled for today
    eventsData.forEach(event => {
      const eventDate = new Date(`${event.date}T${event.time}`);
      if (isSameDay(eventDate, new Date())) {
        const li = document.createElement('li');
        li.textContent = `${event.time}: ${event.title}`;
        todayList.appendChild(li);
      }
    });
  }

  function displayUpcomingEvents(eventsData) {
    const now = new Date();
    const upcomingEvents = eventsData.filter(event => {
      const eventDate = new Date(`${event.date}T${event.time}`);
      const diffTime = eventDate - now;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays > 0 && diffDays <= 7; // Events in the next 7 days
    });

    upcomingEvents.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    upcomingEvents.forEach(event => {
      const li = document.createElement('li');
      li.textContent = `${event.date} ${event.time}: ${event.title}`;
      upcomingList.appendChild(li);
    });
  }

  function displayTasks(tasksData) {
    tasksData.forEach(task => {
      const li = document.createElement('li');
      li.textContent = task.title;
      tasksList.appendChild(li);
    });
  }

  // Utility function to compare dates
  function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
});
