// options.js

// ICS Parser Functions

function parseICS(str) {
  const events = [];
  const lines = str.split(/\r?\n/);
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent) {
        events.push(currentEvent);
        currentEvent = null;
      }
    } else if (currentEvent) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.substring(0, idx);
        const value = line.substring(idx + 1);

        switch (key) {
          case 'SUMMARY':
            currentEvent.summary = value;
            break;
          case 'DTSTART':
            currentEvent.start = parseICalDate(value);
            break;
          case 'DTEND':
            currentEvent.end = parseICalDate(value);
            break;
          case 'RRULE':
            currentEvent.rrule = parseRRule(value);
            break;
          // Handle other properties as needed
        }
      }
    }
  }

  return events;
}

function parseICalDate(value) {
  // Handle date and date-time values
  // Remove any parameters (e.g., VALUE=DATE, TZID, etc.)
  const parts = value.split(';');
  const dateStr = parts[parts.length - 1];

  // Remove 'VALUE=DATE:' if present
  const dateValue = dateStr.replace(/^.*:/, '');

  // Parse date or datetime
  let date;
  if (dateValue.length === 8) {
    // Date only
    date = new Date(
      parseInt(dateValue.substring(0, 4)),
      parseInt(dateValue.substring(4, 6)) - 1,
      parseInt(dateValue.substring(6, 8))
    );
  } else if (dateValue.length >= 15) {
    // Date-time with time zone info
    date = new Date(
      parseInt(dateValue.substring(0, 4)),
      parseInt(dateValue.substring(4, 6)) - 1,
      parseInt(dateValue.substring(6, 8)),
      parseInt(dateValue.substring(9, 11)),
      parseInt(dateValue.substring(11, 13)),
      parseInt(dateValue.substring(13, 15))
    );
  } else {
    // Date-time in basic format
    date = new Date(
      parseInt(dateValue.substring(0, 4)),
      parseInt(dateValue.substring(4, 6)) - 1,
      parseInt(dateValue.substring(6, 8)),
      parseInt(dateValue.substring(9, 11)),
      parseInt(dateValue.substring(11, 13)),
      parseInt(dateValue.substring(13, 15))
    );
  }

  return date;
}

function parseRRule(value) {
  // Simple RRULE parser
  const rrule = {};
  const rules = value.split(';');
  rules.forEach(rule => {
    const [key, val] = rule.split('=');
    rrule[key] = val;
  });
  return rrule;
}

document.addEventListener('DOMContentLoaded', () => {
  const editorDiv = document.getElementById('editor');
  const saveBtn = document.getElementById('save-btn');

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /*** Time Increment Logic ***/

  // Get reference to the time increment select element
  const timeIncrementSelect = document.getElementById('time-increment');

  // Load saved time increment or default to 60 minutes
  chrome.storage.sync.get(['timeIncrement'], (result) => {
    const savedIncrement = result.timeIncrement || '60';
    timeIncrementSelect.value = savedIncrement;

    // Now load the timetable data
    loadTimetableData();
  });

  function loadTimetableData() {
    chrome.storage.sync.get(['timetableData'], (result) => {
      const data = result.timetableData || initializeEmptyTimetable();
      createEditor(data);
    });
  }

  timeIncrementSelect.addEventListener('change', () => {
    const confirmChange = confirm('Changing the time increment will reset your timetable. Do you want to proceed?');
    if (confirmChange) {
      // Clear existing timetable data
      chrome.storage.sync.remove('timetableData', () => {
        // Re-initialize the timetable with the new time increment
        const data = initializeEmptyTimetable();
        createEditor(data);
      });
    } else {
      // Revert to the previous selection
      chrome.storage.sync.get(['timeIncrement'], (result) => {
        timeIncrementSelect.value = result.timeIncrement || '60';
      });
    }
  });

  /*** ICS Import Logic ***/

  const icsFileInput = document.getElementById('ics-file-input');
  const icsImportBtn = document.getElementById('ics-import-btn');

  icsImportBtn.addEventListener('click', () => {
    const file = icsFileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const icsData = e.target.result;
        const events = parseICS(icsData);
        importEventsToTimetable(events);
      };
      reader.readAsText(file);
    } else {
      alert('Please select an ICS file.');
    }
  });

  function importEventsToTimetable(events) {
    // Map events to the timetable data
    // Load the current timetable data
    chrome.storage.sync.get(['timetableData'], (result) => {
      let data = result.timetableData || initializeEmptyTimetable();
      const timeIncrement = parseInt(timeIncrementSelect.value) || 60;
      const timeSlots = getTimeSlots(timeIncrement);

      events.forEach(event => {
        const eventStart = event.start;
        const eventEnd = event.end;
        const summary = event.summary;
        const daysOfWeek = getEventDays(event);

        daysOfWeek.forEach(day => {
          const dayIndex = days.indexOf(day);
          if (dayIndex !== -1) {
            // Find the time slots that match the event time
            const startTime = eventStart.getHours() * 60 + eventStart.getMinutes();
            const endTime = eventEnd.getHours() * 60 + eventEnd.getMinutes();

            for (let i = 0; i < data.length; i++) {
              const row = data[i];
              const slotTime = timeSlots[i];

              if (slotTime >= startTime && slotTime < endTime) {
                // Fill the cell with the event summary
                row[dayIndex + 1] = summary;
              }
            }
          }
        });
      });

      // Update the editor
      createEditor(data);
      showNotification('Schedule imported from ICS file!');
    });
  }

  function getTimeSlots(timeIncrement) {
    const timeSlots = [];
    const startTime = 0 * 60; // 6 AM in minutes
    const endTime = 23 * 60;  // 5 AM The Next Day in minutes

    for (let time = startTime; time <= endTime; time += timeIncrement) {
      timeSlots.push(time);
    }

    return timeSlots;
  }

  function getEventDays(event) {
    // Get the days of the week for the event
    // Handle recurrence if present
    const daysOfWeek = [];

    if (event.rrule && event.rrule.BYDAY) {
      const byDay = event.rrule.BYDAY.split(',');
      byDay.forEach(dayCode => {
        const day = iCalDayToWeekday(dayCode);
        if (day) {
          daysOfWeek.push(day);
        }
      });
    } else {
      // Single event, get the weekday of the start date
      const dayIndex = event.start.getDay(); // 0 (Sunday) to 6 (Saturday)
      const day = days[dayIndex];
      daysOfWeek.push(day);
    }

    return daysOfWeek;
  }

  function iCalDayToWeekday(dayCode) {
    const mapping = {
      'SU': 'Sunday',
      'MO': 'Monday',
      'TU': 'Tuesday',
      'WE': 'Wednesday',
      'TH': 'Thursday',
      'FR': 'Friday',
      'SA': 'Saturday',
    };
    return mapping[dayCode];
  }

  /*** Theme Selection Logic ***/

  // Get references to theme elements
  const themeSelect = document.getElementById('theme-select');
  const customColorsDiv = document.getElementById('custom-colors');
  const backgroundColorInput = document.getElementById('background-color');
  const textColorInput = document.getElementById('text-color');
  const primaryColorInput = document.getElementById('primary-color');
  const secondaryColorInput = document.getElementById('secondary-color');
  const borderColorInput = document.getElementById('border-color');

  // Load saved theme preferences
  chrome.storage.sync.get(['theme', 'customColors'], (result) => {
    const theme = result.theme || 'light';
    themeSelect.value = theme;

    if (theme === 'custom') {
      customColorsDiv.style.display = 'block';
      const customColors = result.customColors || {};
      backgroundColorInput.value = customColors.backgroundColor || '#ffffff';
      textColorInput.value = customColors.textColor || '#000000';
      primaryColorInput.value = customColors.primaryColor || '#4CAF50';
      secondaryColorInput.value = customColors.secondaryColor || '#6c757d';
      borderColorInput.value = customColors.borderColor || '#dddddd';
    } else {
      customColorsDiv.style.display = 'none';
    }

    // Apply the theme immediately
    applyTheme(getThemeColors(theme, result.customColors));
  });

  // Show or hide custom colors section based on theme selection
  themeSelect.addEventListener('change', () => {
    if (themeSelect.value === 'custom') {
      customColorsDiv.style.display = 'block';
      applyTheme(getCustomColors());
    } else {
      customColorsDiv.style.display = 'none';
      applyTheme(getThemeColors(themeSelect.value));
    }
  });

  // Event listeners for custom color inputs
  [backgroundColorInput, textColorInput, primaryColorInput, secondaryColorInput, borderColorInput].forEach(input => {
    input.addEventListener('input', () => {
      applyTheme(getCustomColors());
    });
  });

  /*** Events Management ***/

  const addEventBtn = document.getElementById('add-event-btn');
  const eventsList = document.getElementById('events-list');
  const eventModal = document.getElementById('event-modal');
  const closeEventModal = document.getElementById('close-event-modal');
  const saveEventBtn = document.getElementById('save-event-btn');
  const eventTitleInput = document.getElementById('event-title');
  const eventDateInput = document.getElementById('event-date');
  const eventTimeInput = document.getElementById('event-time');

  let eventsData = [];

  // Load existing events
  chrome.storage.sync.get(['eventsData'], (result) => {
    eventsData = result.eventsData || [];
    displayEvents();
  });

  addEventBtn.addEventListener('click', () => {
    eventModal.classList.remove('hide');
  });

  closeEventModal.addEventListener('click', () => {
    eventModal.classList.add('hide');
    clearEventForm();
  });

  saveEventBtn.addEventListener('click', () => {
    const newEvent = {
      title: eventTitleInput.value,
      date: eventDateInput.value,
      time: eventTimeInput.value
    };
    eventsData.push(newEvent);
    chrome.storage.sync.set({ eventsData }, () => {
      showNotification('Event saved!');
      displayEvents();
      eventModal.classList.add('hide');
      clearEventForm();
    });
  });

  function displayEvents() {
    eventsList.innerHTML = '';
    eventsData.forEach((event, index) => {
      const li = document.createElement('li');
      li.textContent = `${event.date} ${event.time}: ${event.title}`;
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        eventsData.splice(index, 1);
        chrome.storage.sync.set({ eventsData }, () => {
          showNotification('Event deleted!');
          displayEvents();
        });
      });
      li.appendChild(deleteBtn);
      eventsList.appendChild(li);
    });
  }

  function clearEventForm() {
    eventTitleInput.value = '';
    eventDateInput.value = '';
    eventTimeInput.value = '';
  }

  /*** Tasks Management ***/

  const addTaskBtn = document.getElementById('add-task-btn');
  const tasksList = document.getElementById('tasks-list');
  const taskModal = document.getElementById('task-modal');
  const closeTaskModal = document.getElementById('close-task-modal');
  const saveTaskBtn = document.getElementById('save-task-btn');
  const taskTitleInput = document.getElementById('task-title');

  let tasksData = [];

  // Load existing tasks
  chrome.storage.sync.get(['tasksData'], (result) => {
    tasksData = result.tasksData || [];
    displayTasks();
  });

  addTaskBtn.addEventListener('click', () => {
    taskModal.classList.remove('hide');
  });

  closeTaskModal.addEventListener('click', () => {
    taskModal.classList.add('hide');
    clearTaskForm();
  });

  saveTaskBtn.addEventListener('click', () => {
    const newTask = {
      title: taskTitleInput.value
    };
    tasksData.push(newTask);
    chrome.storage.sync.set({ tasksData }, () => {
      showNotification('Task saved!');
      displayTasks();
      taskModal.classList.add('hide');
      clearTaskForm();
    });
  });

  function displayTasks() {
    tasksList.innerHTML = '';
    tasksData.forEach((task, index) => {
      const li = document.createElement('li');
      li.textContent = task.title;
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        tasksData.splice(index, 1);
        chrome.storage.sync.set({ tasksData }, () => {
          showNotification('Task deleted!');
          displayTasks();
        });
      });
      li.appendChild(deleteBtn);
      tasksList.appendChild(li);
    });
  }

  function clearTaskForm() {
    taskTitleInput.value = '';
  }

  /*** Timetable Management ***/

  function createEditor(data) {
    let html = '<table id="timetable-editor"><tr><th>Time</th>';
    days.forEach(day => {
      html += `<th>${day}</th>`;
    });
    html += '</tr>';

    data.forEach((row, rowIndex) => {
      html += '<tr class="timetable-row">';
      row.forEach((cell, cellIndex) => {
        if (cellIndex === 0) {
          // Time label cell
          html += `<td class="time-label">${cell}</td>`;
        } else {
          // Schedule cell
          html += `
            <td class="schedule-cell" data-row="${rowIndex}" data-col="${cellIndex}">
              ${cell ? `<div class="schedule-item"><span class="drag-handle">☰</span><span class="item-content">${cell}</span></div>` : ''}
            </td>
          `;
        }
      });
      html += '</tr>';
    });
    html += '</table>';
    editorDiv.innerHTML = html;

    // Initialize Sortable on the table body
    initSortable();
    initDragAndDrop();
    initEditScheduleItems();
  }

  function initSortable() {
    const table = document.getElementById('timetable-editor');
    const tbody = table.querySelector('tbody') || table;

    Sortable.create(tbody, {
      animation: 150,
      handle: '.time-label', // Only the time labels are draggable handles
      onEnd: function (evt) {
        // Optional: Handle event when drag ends
      }
    });
  }

  function initDragAndDrop() {
    interact('.schedule-item')
      .draggable({
        allowFrom: '.drag-handle', // Only allow dragging from the drag handle
        inertia: true,
        autoScroll: true,
        onmove: dragMoveListener,
        onend: function (event) {
          event.target.style.transform = '';
          event.target.removeAttribute('data-x');
          event.target.removeAttribute('data-y');
        }
      });

    interact('.schedule-cell')
      .dropzone({
        accept: '.schedule-item',
        overlap: 0.75,
        ondragenter: function (event) {
          event.target.classList.add('drop-target');
          event.relatedTarget.classList.add('can-drop');
        },
        ondragleave: function (event) {
          event.target.classList.remove('drop-target');
          event.relatedTarget.classList.remove('can-drop');
        },
        ondrop: function (event) {
          const draggedItem = event.relatedTarget;
          const dropzone = event.target;

          // Remove the item from its original cell
          const sourceCell = draggedItem.parentElement;
          if (sourceCell !== dropzone) {
            sourceCell.innerHTML = '';
            // Add the item to the new cell
            dropzone.innerHTML = '';
            dropzone.appendChild(draggedItem);

            // Update positions
            draggedItem.style.transform = '';
            draggedItem.removeAttribute('data-x');
            draggedItem.removeAttribute('data-y');

            // Reinitialize editing on the new cell
            initEditScheduleItems();
          }
        },
        ondropdeactivate: function (event) {
          event.target.classList.remove('drop-active');
          event.target.classList.remove('drop-target');
        }
      });
  }

  function dragMoveListener(event) {
    var target = event.target,
      // keep the dragged position in the data-x/data-y attributes
      x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
      y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

    // translate the element
    target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

    // update the position attributes
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
  }

  function initEditScheduleItems() {
    const cells = document.querySelectorAll('.schedule-cell');

    cells.forEach(cell => {
      cell.addEventListener('dblclick', () => {
        let currentContent = '';
        const scheduleItem = cell.querySelector('.schedule-item');
        if (scheduleItem) {
          currentContent = scheduleItem.querySelector('.item-content').textContent;
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentContent;
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();

        // Function to save the input value
        function saveInput() {
          const value = input.value.trim();
          cell.innerHTML = '';
          if (value) {
            const item = document.createElement('div');
            item.className = 'schedule-item';
            item.innerHTML = `<span class="drag-handle">☰</span><span class="item-content">${value}</span>`;
            cell.appendChild(item);
            initDragAndDrop(); // Re-initialize drag and drop for new items
          }
        }

        // Listen for blur event
        input.addEventListener('blur', () => {
          saveInput();
        });

        // Listen for Enter key
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            saveInput();
            input.blur(); // Ensure the input loses focus
          }
        });
      });
    });
  }

  // Save button event listener
  saveBtn.addEventListener('click', () => {
    const data = [];
    const rows = document.querySelectorAll('.timetable-row');
    rows.forEach((row, rowIndex) => {
      const rowData = [];
      // Get the time label
      const timeLabel = row.querySelector('.time-label').textContent;
      rowData.push(timeLabel);

      // Get the schedule cells
      const cells = row.querySelectorAll('.schedule-cell');
      cells.forEach((cell, cellIndex) => {
        const scheduleItem = cell.querySelector('.schedule-item .item-content');
        const value = scheduleItem ? scheduleItem.textContent : '';
        rowData.push(value);
      });
      data.push(rowData);
    });

    // Save the timetable data
    chrome.storage.sync.set({ timetableData: data }, () => {
      if (chrome.runtime.lastError) {
        showNotification('Error saving timetable: ' + chrome.runtime.lastError.message);
      } else {
        showNotification('Timetable saved!');
      }
    });

    /*** Save Time Increment ***/
    const timeIncrement = timeIncrementSelect.value;
    chrome.storage.sync.set({ timeIncrement }, () => {
      // Time increment saved
    });

    /*** Save Theme Preferences ***/
    const theme = themeSelect.value;
    let customColors = null;

    if (theme === 'custom') {
      customColors = getCustomColors();
    }

    // Save theme and custom colors to storage
    chrome.storage.sync.set({ theme, customColors }, () => {
      // Theme preferences saved
    });
  });

  function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    notification.classList.remove('hide');

    setTimeout(() => {
      notification.classList.add('hide');
      notification.classList.remove('show');
    }, 3000); // Hide after 3 seconds
  }

  function initializeEmptyTimetable() {
    const data = [];

    // Get the selected time increment
    const timeIncrement = parseInt(timeIncrementSelect.value) || 60;

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

  /*** Theme Application Functions ***/

  function applyTheme(colors) {
    document.documentElement.style.setProperty('--background-color', colors.backgroundColor);
    document.documentElement.style.setProperty('--text-color', colors.textColor);
    document.documentElement.style.setProperty('--primary-color', colors.primaryColor);
    document.documentElement.style.setProperty('--secondary-color', colors.secondaryColor);
    document.documentElement.style.setProperty('--border-color', colors.borderColor);
  }

  function getThemeColors(theme, customColors = {}) {
    if (theme === 'custom') {
      return customColors;
    } else if (theme === 'dark') {
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

  function getCustomColors() {
    return {
      backgroundColor: backgroundColorInput.value,
      textColor: textColorInput.value,
      primaryColor: primaryColorInput.value,
      secondaryColor: secondaryColorInput.value,
      borderColor: borderColorInput.value
    };
  }
});
