/***********************
 * options.js
 * Timely Tab (weekMap + multi-week ICS + debug logs)
 * Uses chrome.storage.local to avoid quota issues
 ***********************/

// We'll store the days in an array for labeling columns
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// We'll track the "current week start" date globally
let currentWeekStart = null;

// Local copies of events/tasks
let eventsData = [];
let tasksData  = [];

/*************************************************************
 * DOMContentLoaded - Main Entry
 *************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  console.log('[DEBUG] DOMContentLoaded - Loading data (weekMap + multi-week ICS + debug logs)...');

  /************************************
   * 1) SETTINGS PANEL TOGGLE
   ************************************/
  const settingsToggleBtn = document.getElementById('settings-toggle');
  const settingsPanel     = document.getElementById('settings-panel');

  settingsToggleBtn.addEventListener('click', () => {
    if (settingsPanel.classList.contains('hide')) {
      settingsPanel.classList.remove('hide');
      settingsToggleBtn.textContent = 'Settings ▲';
    } else {
      settingsPanel.classList.add('hide');
      settingsToggleBtn.textContent = 'Settings ▼';
    }
  });

  /************************************
   * 2) BASIC REFERENCES
   ************************************/
  const timeIncrementSelect = document.getElementById('time-increment');
  const dayStartInput       = document.getElementById('day-start');
  const dayEndInput         = document.getElementById('day-end');

  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');

  const icsFileInput = document.getElementById('ics-file-input');
  const icsImportBtn = document.getElementById('ics-import-btn');

  /************************************
   * THEME ELEMENTS
   ************************************/
  const themeSelect         = document.getElementById('theme-select');
  const customColorsDiv     = document.getElementById('custom-colors');
  const backgroundColorInput= document.getElementById('background-color');
  const textColorInput      = document.getElementById('text-color');
  const primaryColorInput   = document.getElementById('primary-color');
  const secondaryColorInput = document.getElementById('secondary-color');
  const borderColorInput    = document.getElementById('border-color');

  /************************************
   * 3) LOAD INITIAL DATA
   ************************************/
  chrome.storage.local.get(
    [
      'timeIncrement', 'dayStart', 'dayEnd', 'weekStart',
      'theme', 'customColors',
      'eventsData', 'tasksData',
      'weekMap' // Our timetable data store
    ],
    (res) => {
      if (chrome.runtime.lastError) {
        console.error('[DEBUG] Error reading from storage:', chrome.runtime.lastError);
      } else {
        console.log('[DEBUG] Successfully read initial data from storage:', res);
      }

      // Time/timetable
      timeIncrementSelect.value = res.timeIncrement || '60';
      dayStartInput.value       = res.dayStart     || '08:00';
      dayEndInput.value         = res.dayEnd       || '22:00';

      if (res.weekStart) {
        currentWeekStart = new Date(res.weekStart);
      } else {
        currentWeekStart = getStartOfWeek(new Date());
        chrome.storage.local.set({ weekStart: currentWeekStart.toISOString() });
      }
      console.log('[DEBUG] currentWeekStart =', currentWeekStart.toISOString());

      // Theme
      const theme = res.theme || 'light';
      themeSelect.value = theme;
      if (theme === 'custom') {
        customColorsDiv.style.display = 'block';
      } else {
        customColorsDiv.style.display = 'none';
      }
      const userColors = res.customColors || {};
      backgroundColorInput.value = userColors.backgroundColor || '#ffffff';
      textColorInput.value       = userColors.textColor       || '#000000';
      primaryColorInput.value    = userColors.primaryColor    || '#4CAF50';
      secondaryColorInput.value  = userColors.secondaryColor  || '#6c757d';
      borderColorInput.value     = userColors.borderColor     || '#dddddd';

      applyTheme(getThemeColors(theme, userColors));

      // Events & Tasks
      eventsData = res.eventsData || [];
      tasksData  = res.tasksData  || [];
      displayEvents();
      displayTasks();

      // Load the timetable for the current week
      console.log('[DEBUG] loadTimetableData for week:', currentWeekStart.toISOString().substring(0,10));
      loadTimetableData();
    }
  );

  /************************************
   * 4) TIME & WEEK NAV
   ************************************/
  timeIncrementSelect.addEventListener('change', () => {
    if (!confirm('Changing time increment resets this week. Continue?')) {
      chrome.storage.local.get(['timeIncrement'], (res) => {
        timeIncrementSelect.value = res.timeIncrement || '60';
      });
      return;
    }
    chrome.storage.local.set({ timeIncrement: timeIncrementSelect.value }, () => {
      console.log('[DEBUG] timeIncrement changed to', timeIncrementSelect.value);
      resetCurrentWeekData();
    });
  });

  dayStartInput.addEventListener('change', () => {
    chrome.storage.local.set({ dayStart: dayStartInput.value }, () => {
      console.log('[DEBUG] dayStart changed to', dayStartInput.value);
      resetCurrentWeekData();
    });
  });
  dayEndInput.addEventListener('change', () => {
    chrome.storage.local.set({ dayEnd: dayEndInput.value }, () => {
      console.log('[DEBUG] dayEnd changed to', dayEndInput.value);
      resetCurrentWeekData();
    });
  });

  function resetCurrentWeekData() {
    const weekKey = getWeekKey(currentWeekStart);
    console.log('[DEBUG] resetCurrentWeekData -> clearing data for', weekKey);
    chrome.storage.local.get(['weekMap'], (res) => {
      const allData = res.weekMap || {};
      delete allData[weekKey];
      chrome.storage.local.set({ weekMap: allData }, () => {
        console.log('[DEBUG] Done clearing. Reloading timetable...');
        loadTimetableData();
      });
    });
  }

  prevWeekBtn.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    chrome.storage.local.set({ weekStart: currentWeekStart.toISOString() }, () => {
      console.log('[DEBUG] Moved to previous week ->', currentWeekStart.toISOString());
      loadTimetableData();
    });
  });

  nextWeekBtn.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    chrome.storage.local.set({ weekStart: currentWeekStart.toISOString() }, () => {
      console.log('[DEBUG] Moved to next week ->', currentWeekStart.toISOString());
      loadTimetableData();
    });
  });

  /************************************
   * 5) MULTI-WEEK ICS IMPORT
   ************************************/
  if (icsImportBtn) {
    icsImportBtn.addEventListener('click', () => {
      const file = icsFileInput.files[0];
      if (!file) {
        alert('Please select an ICS file first.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const icsData = e.target.result;
        const events  = parseICS(icsData);
        console.log('[DEBUG] ICS events parsed:', events);
        importMultiWeekEvents(events);
      };
      reader.readAsText(file);
    });
  }

  /**
   * For each ICS event, store it in *all* relevant weeks if it spans multiple weeks
   */
  function importMultiWeekEvents(events) {
    console.log('[DEBUG] importMultiWeekEvents - total events:', events.length);
    chrome.storage.local.get(['weekMap', 'timeIncrement', 'dayStart', 'dayEnd'], (res) => {
      const allData = res.weekMap || {};
      const timeIncrement = parseInt(res.timeIncrement) || 60;
      const startStr = res.dayStart || '08:00';
      const endStr   = res.dayEnd   || '22:00';

      events.forEach(ev => {
        if (!ev.start || !ev.end || !ev.summary) {
          console.warn('[DEBUG] Skipping event with missing fields:', ev);
          return;
        }
        if (ev.end < ev.start) {
          console.log('[DEBUG] Event end < start. Swapping...');
          [ev.start, ev.end] = [ev.end, ev.start];
        }
        console.log('[DEBUG] Processing event:', ev.summary, 
                    'Start:', ev.start, 'End:', ev.end);

        // Gather all Sunday "week starts" from eventStart to eventEnd
        const weekStarts = getAllWeekStartsInRange(ev.start, ev.end);
        console.log('[DEBUG] -> Weeks spanned by this event:', 
                    weekStarts.map(ws => ws.toISOString().substring(0,10)));

        // For each Sunday in that range, update partial overlap
        weekStarts.forEach(weekSunday => {
          const wKey = getWeekKey(weekSunday);
          let weekData = allData[wKey];
          if (!weekData) {
            console.log('[DEBUG] No data found for', wKey, '- creating new empty table...');
            weekData = initializeEmptyTimetable({
              timeIncrement: timeIncrement.toString(),
              dayStart: startStr,
              dayEnd:   endStr
            });
          }

          // Place partial overlap
          placeEventInSingleWeek(weekData, weekSunday, ev.start, ev.end, ev.summary, timeIncrement, startStr, endStr);

          // Save back
          allData[wKey] = weekData;
        });
      });

      // Finally, store updated weekMap
      chrome.storage.local.set({ weekMap: allData }, () => {
        if (chrome.runtime.lastError) {
          console.error('[DEBUG] multi-week ICS -> error saving data:', chrome.runtime.lastError);
        } else {
          console.log('[DEBUG] Multi-week ICS import -> updated all relevant weeks in weekMap.');
          showNotification('Multi-week ICS schedule imported!');
          // Reload the *current* displayed week
          loadTimetableData();
        }
      });
    });
  }

  /**
   * placeEventInSingleWeek: single-week partial overlap logic
   */
  function placeEventInSingleWeek(weekData, sundayDate, evStart, evEnd, summary, inc, startStr, endStr) {
    const startOfWeek = new Date(sundayDate);
    const endOfWeek   = new Date(sundayDate);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    console.log('[DEBUG] placeEventInSingleWeek -> week Sunday:', sundayDate.toISOString().substring(0,10),
                ', event:', summary, 
                ', range:', evStart, '-', evEnd);

    // If no overlap, do nothing
    if (evEnd < startOfWeek || evStart > endOfWeek) {
      console.log('[DEBUG] -> No overlap with this week. Skipping.');
      return;
    }

    // Ensure we define getTimeSlots
    const timeSlots = getTimeSlots(startStr, endStr, inc);

    // For each day col
    for (let d = 0; d < 7; d++) {
      const colIndex = d + 1; 
      const dayDate = new Date(sundayDate);
      dayDate.setDate(sundayDate.getDate() + d);

      for (let r = 0; r < weekData.length; r++) {
        const slotMin = timeSlots[r];
        const rowDate = new Date(dayDate);
        rowDate.setHours(Math.floor(slotMin / 60), slotMin % 60, 0, 0);

        if (rowDate >= evStart && rowDate < evEnd) {
          console.log('[DEBUG] -> Placing', summary, 
                      'in row', r, 'col', colIndex, 
                      'time', rowDate);
          weekData[r][colIndex] = summary;
        }
      }
    }
  }

  /**
   * getAllWeekStartsInRange: returns an array of Sunday "week starts"
   * from the Sunday of eventStart up to the Sunday of eventEnd (inclusive).
   */
  function getAllWeekStartsInRange(eventStart, eventEnd) {
    let weeks = [];
    let cur = getStartOfWeek(eventStart);
    const endSunday = getStartOfWeek(eventEnd);

    while (cur <= endSunday) {
      // push a copy so we don't mutate `cur`
      weeks.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return weeks;
  }

  /************************************
   * 6) THEME
   ************************************/
  themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value;
    if (theme === 'custom') {
      customColorsDiv.style.display = 'block';
      applyTheme(getCustomColors());
    } else {
      customColorsDiv.style.display = 'none';
      applyTheme(getThemeColors(theme));
    }
    saveThemePrefs();
  });

  [backgroundColorInput, textColorInput, primaryColorInput, secondaryColorInput, borderColorInput].forEach(inp => {
    inp.addEventListener('input', () => {
      if (themeSelect.value === 'custom') {
        applyTheme(getCustomColors());
        saveThemePrefs();
      }
    });
  });

  function saveThemePrefs() {
    const theme = themeSelect.value;
    let customColors = null;
    if (theme === 'custom') {
      customColors = getCustomColors();
    }
    chrome.storage.local.set({ theme, customColors }, () => {
      if (chrome.runtime.lastError) {
        console.error('[DEBUG] Error saving theme prefs:', chrome.runtime.lastError);
      }
    });
  }

  function applyTheme(colors) {
    document.documentElement.style.setProperty('--background-color', colors.backgroundColor);
    document.documentElement.style.setProperty('--text-color',       colors.textColor);
    document.documentElement.style.setProperty('--primary-color',    colors.primaryColor);
    document.documentElement.style.setProperty('--secondary-color',  colors.secondaryColor);
    document.documentElement.style.setProperty('--border-color',     colors.borderColor);
  }

  function getThemeColors(theme, custom = {}) {
    if (theme === 'custom') {
      return custom;
    } else if (theme === 'dark') {
      return {
        backgroundColor: '#121212',
        textColor:       '#ffffff',
        primaryColor:    '#bb86fc',
        secondaryColor:  '#03dac6',
        borderColor:     '#333333'
      };
    } else {
      // light
      return {
        backgroundColor: '#ffffff',
        textColor:       '#000000',
        primaryColor:    '#4CAF50',
        secondaryColor:  '#6c757d',
        borderColor:     '#dddddd'
      };
    }
  }

  function getCustomColors() {
    return {
      backgroundColor: backgroundColorInput.value,
      textColor:       textColorInput.value,
      primaryColor:    primaryColorInput.value,
      secondaryColor:  secondaryColorInput.value,
      borderColor:     borderColorInput.value
    };
  }

  /************************************
   * 7) EVENTS & TASKS
   ************************************/
  const addEventBtn       = document.getElementById('add-event-btn');
  const eventsList        = document.getElementById('events-list');
  const eventModal        = document.getElementById('event-modal');
  const closeEventModal   = document.getElementById('close-event-modal');
  const saveEventBtn      = document.getElementById('save-event-btn');
  const eventTitleInput   = document.getElementById('event-title');
  const eventDateInput    = document.getElementById('event-date');
  const eventTimeInput    = document.getElementById('event-time');

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
      date:  eventDateInput.value,
      time:  eventTimeInput.value
    };
    eventsData.push(newEvent);
    chrome.storage.local.set({ eventsData }, () => {
      if (chrome.runtime.lastError) {
        console.error('[DEBUG] Error saving new event:', chrome.runtime.lastError);
      } else {
        showNotification('Event saved!');
        displayEvents();
        eventModal.classList.add('hide');
        clearEventForm();
      }
    });
  });

  function displayEvents() {
    eventsList.innerHTML = '';
    eventsData.forEach((ev, idx) => {
      const li = document.createElement('li');
      li.textContent = `${ev.date} ${ev.time}: ${ev.title}`;
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        eventsData.splice(idx, 1);
        chrome.storage.local.set({ eventsData }, () => {
          if (chrome.runtime.lastError) {
            console.error('[DEBUG] Error deleting event:', chrome.runtime.lastError);
          } else {
            showNotification('Event deleted!');
            displayEvents();
          }
        });
      });
      li.appendChild(delBtn);
      eventsList.appendChild(li);
    });
  }
  function clearEventForm() {
    eventTitleInput.value = '';
    eventDateInput.value  = '';
    eventTimeInput.value  = '';
  }

  // Tasks
  const addTaskBtn     = document.getElementById('add-task-btn');
  const tasksList      = document.getElementById('tasks-list');
  const taskModal      = document.getElementById('task-modal');
  const closeTaskModal = document.getElementById('close-task-modal');
  const saveTaskBtn    = document.getElementById('save-task-btn');
  const taskTitleInput = document.getElementById('task-title');

  addTaskBtn.addEventListener('click', () => {
    taskModal.classList.remove('hide');
  });
  closeTaskModal.addEventListener('click', () => {
    taskModal.classList.add('hide');
    clearTaskForm();
  });
  saveTaskBtn.addEventListener('click', () => {
    const newTask = { title: taskTitleInput.value };
    tasksData.push(newTask);
    chrome.storage.local.set({ tasksData }, () => {
      if (chrome.runtime.lastError) {
        console.error('[DEBUG] Error saving new task:', chrome.runtime.lastError);
      } else {
        showNotification('Task saved!');
        displayTasks();
        taskModal.classList.add('hide');
        clearTaskForm();
      }
    });
  });

  function displayTasks() {
    tasksList.innerHTML = '';
    tasksData.forEach((task, idx) => {
      const li = document.createElement('li');
      li.textContent = task.title;
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        tasksData.splice(idx, 1);
        chrome.storage.local.set({ tasksData }, () => {
          if (chrome.runtime.lastError) {
            console.error('[DEBUG] Error deleting task:', chrome.runtime.lastError);
          } else {
            showNotification('Task deleted!');
            displayTasks();
          }
        });
      });
      li.appendChild(delBtn);
      tasksList.appendChild(li);
    });
  }
  function clearTaskForm() {
    taskTitleInput.value = '';
  }

  /************************************
   * 8) TIMETABLE (weekMap)
   ************************************/
  function loadTimetableData() {
    const weekKey = getWeekKey(currentWeekStart);
    console.log('[DEBUG] loadTimetableData -> weekKey:', weekKey);

    chrome.storage.local.get(
      ['weekMap', 'timeIncrement', 'dayStart', 'dayEnd'],
      (res) => {
        if (chrome.runtime.lastError) {
          console.error('[DEBUG] Error reading weekMap:', chrome.runtime.lastError);
          return;
        }
        const allData = res.weekMap || {}; 
        let weekData = allData[weekKey];

        if (!weekData) {
          console.log('[DEBUG] No data found for', weekKey, '- creating new empty table...');
          weekData = initializeEmptyTimetable(res);
          allData[weekKey] = weekData;
          chrome.storage.local.set({ weekMap: allData }, () => {
            if (chrome.runtime.lastError) {
              console.error('[DEBUG] Error creating new empty table in weekMap:', chrome.runtime.lastError);
            } else {
              console.log('[DEBUG] Created new empty table for', weekKey, ' in weekMap.');
            }
          });
        }
        createEditor(weekData);
      }
    );
  }

  function initializeEmptyTimetable(storage) {
    console.log('[DEBUG] initializeEmptyTimetable (weekMap) with:', storage);
    const data = [];
    const inc = parseInt(storage.timeIncrement) || 60;
    const startMins = parseTimeStr(storage.dayStart || '08:00');
    let endMins     = parseTimeStr(storage.dayEnd   || '22:00');

    if (endMins <= startMins) {
      console.log('[DEBUG] dayEnd <= dayStart, adding 24h to endMins to handle cross-midnight...');
      endMins += 24 * 60;
    }

    for (let t = startMins; t <= endMins; t += inc) {
      const hour24 = Math.floor(t / 60) % 24;
      const mins   = t % 60;
      const ampm   = hour24 >= 12 ? 'PM' : 'AM';
      const displayHour = (hour24 % 12) === 0 ? 12 : (hour24 % 12);
      const timeLabel = `${displayHour}:${String(mins).padStart(2, '0')} ${ampm}`;
      const row = [timeLabel];
      for (let d = 0; d < 7; d++) {
        row.push('');
      }
      data.push(row);
    }
    return data;
  }

  function createEditor(weekData) {
    console.log('[DEBUG] createEditor (weekMap) -> received weekData:', weekData);
    const editorDiv = document.getElementById('editor');
    let html = '<table id="timetable-editor"><thead><tr>';
    html += '<th>Time</th>';

    for (let i = 0; i < 7; i++) {
      const colDate = new Date(currentWeekStart);
      colDate.setDate(colDate.getDate() + i);
      const dayName = days[colDate.getDay()];
      const dateStr = colDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      html += `<th>${dayName} (${dateStr})</th>`;
    }
    html += '</tr></thead><tbody>';

    weekData.forEach((row, rowIndex) => {
      html += '<tr class="timetable-row">';
      row.forEach((cell, cellIndex) => {
        if (cellIndex === 0) {
          html += `<td class="time-label">${cell}</td>`;
        } else {
          html += `
            <td class="schedule-cell" data-row="${rowIndex}" data-col="${cellIndex}">
              ${cell ? `<div class="schedule-item"><span class="drag-handle">☰</span><span class="item-content">${cell}</span></div>` : ''}
            </td>`;
        }
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    editorDiv.innerHTML = html;

    initSortable();
    initDragAndDrop();
    initEditScheduleItems();

    console.log('[DEBUG] Timetable rendered. Rows:', weekData.length);
  }

  function autoSaveTimetable() {
    console.log('[DEBUG] autoSaveTimetable called (weekMap)...');
    const weekKey = getWeekKey(currentWeekStart);
    const rows = document.querySelectorAll('.timetable-row');
    const newWeekData = [];

    rows.forEach((row) => {
      const rowData = [];
      const timeLabel = row.querySelector('.time-label').textContent;
      rowData.push(timeLabel);

      const cells = row.querySelectorAll('.schedule-cell');
      cells.forEach((cell) => {
        const scheduleItem = cell.querySelector('.schedule-item .item-content');
        rowData.push(scheduleItem ? scheduleItem.textContent : '');
      });
      newWeekData.push(rowData);
    });

    console.log('[DEBUG] newWeekData to save for', weekKey, ':', newWeekData);

    chrome.storage.local.get(['weekMap'], (res) => {
      const allData = res.weekMap || {};
      allData[weekKey] = newWeekData;
      chrome.storage.local.set({ weekMap: allData }, () => {
        if (chrome.runtime.lastError) {
          console.error('[DEBUG] Error saving timetable to weekMap:', chrome.runtime.lastError);
        } else {
          console.log('[DEBUG] Timetable saved successfully for', weekKey, 'in weekMap.');
        }
      });
    });
  }

  function initSortable() {
    const table = document.getElementById('timetable-editor');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    Sortable.create(tbody, {
      animation: 150,
      handle: '.time-label',
      onEnd: () => {
        console.log('[DEBUG] Rows reordered -> autoSaveTimetable (weekMap).');
        autoSaveTimetable();
      }
    });
  }

  function initDragAndDrop() {
    interact('.schedule-item').draggable({
      allowFrom: '.drag-handle',
      inertia: true,
      autoScroll: true,
      onmove: dragMoveListener,
      onend: function(event) {
        event.target.style.transform = '';
        event.target.removeAttribute('data-x');
        event.target.removeAttribute('data-y');
      }
    });

    interact('.schedule-cell').dropzone({
      accept: '.schedule-item',
      overlap: 0.75,
      ondragenter(event) {
        event.target.classList.add('drop-target');
        event.relatedTarget.classList.add('can-drop');
      },
      ondragleave(event) {
        event.target.classList.remove('drop-target');
        event.relatedTarget.classList.remove('can-drop');
      },
      ondrop(event) {
        const draggedItem = event.relatedTarget;
        const dropzone = event.target;
        const sourceCell = draggedItem.parentElement;
        if (sourceCell !== dropzone) {
          sourceCell.innerHTML = '';
          dropzone.innerHTML = '';
          dropzone.appendChild(draggedItem);

          draggedItem.style.transform = '';
          draggedItem.removeAttribute('data-x');
          draggedItem.removeAttribute('data-y');

          initEditScheduleItems();
          console.log('[DEBUG] Dropped item -> autoSaveTimetable (weekMap).');
          autoSaveTimetable();
        }
      },
      ondropdeactivate(event) {
        event.target.classList.remove('drop-active');
        event.target.classList.remove('drop-target');
      }
    });
  }

  function dragMoveListener(event) {
    const target = event.target;
    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
    target.style.transform = `translate(${x}px, ${y}px)`;
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

        function saveInput() {
          const value = input.value.trim();
          cell.innerHTML = '';
          if (value) {
            const item = document.createElement('div');
            item.className = 'schedule-item';
            item.innerHTML = `<span class="drag-handle">☰</span><span class="item-content">${value}</span>`;
            cell.appendChild(item);
            initDragAndDrop();
          }
          console.log('[DEBUG] Double-click edit -> autoSaveTimetable (weekMap).');
          autoSaveTimetable();
        }

        input.addEventListener('blur', saveInput);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            saveInput();
            input.blur();
          }
        });
      });
    });
  }

  /************************************
   * 9) HELPER FUNCTIONS
   ************************************/
  function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.classList.add('show');
    notification.classList.remove('hide');
    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('hide');
    }, 3000);
  }

  function getStartOfWeek(date) {
    const day = date.getDay(); // Sunday=0
    const diff = date.getDate() - day;
    const sunday = new Date(date);
    sunday.setDate(diff);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }

  function getWeekKey(dateObj) {
    return dateObj.toISOString().substring(0, 10);
  }

  function parseTimeStr(str) {
    const [hh, mm] = str.split(':');
    return parseInt(hh, 10) * 60 + parseInt(mm, 10);
  }
});

/*******************************************
 * ICS Parsing (with debug logs + getTimeSlots fix)
 *******************************************/
function parseICS(str) {
  console.log('[DEBUG] parseICS: raw ICS data:\n', str);
  const events = [];
  const lines = str.split(/\r?\n/);
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
      console.log('[DEBUG] Found BEGIN:VEVENT');
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent) {
        events.push(currentEvent);
        console.log('[DEBUG] Found END:VEVENT, pushed event:', currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.substring(0, idx);
        const val = line.substring(idx + 1);
        if (key === 'SUMMARY') {
          currentEvent.summary = val;
          console.log('[DEBUG] SUMMARY =', val);
        } else if (key === 'DTSTART') {
          currentEvent.start = parseICalDate(val);
          console.log('[DEBUG] DTSTART =', val, '->', currentEvent.start);
        } else if (key === 'DTEND') {
          currentEvent.end = parseICalDate(val);
          console.log('[DEBUG] DTEND   =', val, '->', currentEvent.end);
        }
      }
    }
  }

  console.log('[DEBUG] parseICS -> final events array:', events);
  return events;
}

/**
 * parseICalDate with debugging + handling trailing 'Z'
 */
function parseICalDate(value) {
  console.log('[DEBUG] parseICalDate raw value:', value);

  let dateValue = value.replace(/^.*:/, ''); // remove TZID= or similar
  let isUTC = false;

  // If trailing 'Z', treat as UTC
  if (dateValue.endsWith('Z')) {
    isUTC = true;
    dateValue = dateValue.slice(0, -1); // remove the 'Z'
  }

  // e.g. "20250105T130000"
  const year  = parseInt(dateValue.substring(0, 4));
  const month = parseInt(dateValue.substring(4, 6)) - 1;
  const day   = parseInt(dateValue.substring(6, 8));
  let hour = 0, min = 0, sec = 0;
  if (dateValue.length >= 15) {
    hour = parseInt(dateValue.substring(9, 11)) || 0;
    min  = parseInt(dateValue.substring(11, 13)) || 0;
    sec  = parseInt(dateValue.substring(13, 15)) || 0;
  }

  let d;
  if (isUTC) {
    d = new Date(Date.UTC(year, month, day, hour, min, sec));
  } else {
    d = new Date(year, month, day, hour, min, sec);
  }

  if (isNaN(d.getTime())) {
    console.warn('[DEBUG] parseICalDate -> invalid date for:', value, '(isUTC:', isUTC, ')');
  }
  return d;
}

/**
 * getTimeSlots used by placeEventInSingleWeek
 * Generates minute-of-day slots from startStr..endStr with increment inc,
 * handling cross-midnight if end <= start.
 */
function getTimeSlots(startStr, endStr, inc) {
  console.log('[DEBUG] getTimeSlots -> startStr:', startStr, 'endStr:', endStr, 'inc:', inc);

  const slots = [];
  const sMins = parseTimeStr(startStr); 
  let eMins   = parseTimeStr(endStr);   
  if (eMins <= sMins) {
    console.log('[DEBUG] getTimeSlots: end <= start, adding 24h for cross-midnight...');
    eMins += 24 * 60;
  }

  for (let t = sMins; t <= eMins; t += inc) {
    slots.push(t % (24 * 60));
  }

  console.log('[DEBUG] getTimeSlots -> returning:', slots);
  return slots;
}

/**
 * parseTimeStr used by getTimeSlots
 */
function parseTimeStr(str) {
  const [hh, mm] = str.split(':');
  return parseInt(hh, 10) * 60 + parseInt(mm, 10);
}
