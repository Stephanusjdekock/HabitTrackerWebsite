// script.js
// Habit Tracker Application

// ----------------------------
// Application State
// ----------------------------
const state = {
  habits: [],
  currentDay: 1,
  dayHistory: {},
  sortField: 'name',
  sortDirection: 'asc',
  editingHabitId: null,
  lastCompletionRate: null,
  undoStack: [],
  redoStack: []
};

const chartLineVisibility = {}; // Tracks visibility of each habit line in chart

// ----------------------------
// DOM Elements
// ----------------------------
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const habitNameInput = document.getElementById('habitName');
const habitSuggestionsEl = document.getElementById('habitSuggestions');
const addHabitBtn = document.getElementById('addHabit');
const habitsListEl = document.getElementById('habitsList');
const currentDayEl = document.getElementById('currentDay');
const submitDayBtn = document.getElementById('submitDay');
const completionRateEl = document.querySelector('.completion-rate');
const tableBodyEl = document.getElementById('tableBody');
const tableSearch = document.getElementById('tableSearch');
const resetFiltersBtn = document.getElementById('resetFilters');
const tableHeaders = document.querySelectorAll('th[data-sort]');
const restartBtn = document.getElementById('restartBtn');
const undoDayBtn = document.getElementById('undoDay');
const redoDayBtn = document.getElementById('redoDay');

const selectAllHabitsBtn = document.getElementById('selectAllHabits');
const deselectAllHabitsBtn = document.getElementById('deselectAllHabits');
const selectAllChartBtn = document.getElementById('selectAllChart');
const deselectAllChartBtn = document.getElementById('deselectAllChart');

const streakChartBtn = document.getElementById('streakChartBtn');
const completionChartBtn = document.getElementById('completionChartBtn');
const failChartBtn = document.getElementById('failChartBtn');
let currentChartType = "streak";  // "streak", "completion", or "fail"

// ----------------------------
// Helper Functions
// ----------------------------
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

function showModal(title, message, confirmText, cancelText, confirmCallback) {
  removeModal();
  
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-container';
  
  const modalHeader = document.createElement('div');
  modalHeader.className = 'modal-header';
  const modalTitle = document.createElement('h3');
  modalTitle.textContent = title;
  modalHeader.appendChild(modalTitle);
  
  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';
  modalBody.textContent = message;
  
  const modalFooter = document.createElement('div');
  modalFooter.className = 'modal-footer';
  
  if (cancelText) {
    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn-secondary';
    cancelButton.textContent = cancelText;
    cancelButton.addEventListener('click', removeModal);
    modalFooter.appendChild(cancelButton);
  }
  
  const confirmButton = document.createElement('button');
  confirmButton.textContent = confirmText;
  if (["Delete", "Restart", "Undo", "Redo"].includes(confirmText)) {
    confirmButton.classList.add('btn-danger');
  }
  confirmButton.addEventListener('click', () => {
    removeModal();
    if (confirmCallback) confirmCallback();
  });
  modalFooter.appendChild(confirmButton);
  
  modalContainer.append(modalHeader, modalBody, modalFooter);
  modalOverlay.appendChild(modalContainer);
  document.body.appendChild(modalOverlay);
  
  // Insert modal styles only once
  if (!document.getElementById('modalStyle')) {
    const style = document.createElement('style');
    style.id = 'modalStyle';
    style.textContent = `
      .modal-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        animation: fadeIn 0.3s ease-out;
      }
      .modal-container {
        background-color: white;
        border-radius: 20px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        width: 100%;
        max-width: 400px;
        overflow: hidden;
      }
      .modal-header {
        background-color: var(--primary);
        padding: 15px 20px;
        border-radius: 20px 20px 0 0;
      }
      .modal-header h3 {
        color: white;
        margin: 0;
        font-size: 18px;
      }
      .modal-body {
        padding: 20px;
        line-height: 1.5;
      }
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 15px 20px;
        gap: 10px;
        border-top: 1px solid #eee;
      }
    `;
    document.head.appendChild(style);
  }
}

function removeModal() {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();
}

function updateCompletionRate() {
  if (state.habits.length === 0) {
    completionRateEl.textContent = '0% completed today';
    return;
  }
  if (state.lastCompletionRate !== null) {
    completionRateEl.textContent = `${state.lastCompletionRate}% completed today`;
  } else {
    const completedCount = state.habits.filter(habit => habit.completed).length;
    const percentage = Math.round((completedCount / state.habits.length) * 100);
    completionRateEl.textContent = `${percentage}% completed today`;
  }
}

function getCompletedDays(habit) {
  let count = 0;
  for (let d = habit.startDay; d < state.currentDay; d++) {
    if (habit.history[d]) count++;
  }
  return count;
}

// ----------------------------
// Data Persistence
// ----------------------------
function loadData() {
  const savedData = localStorage.getItem('habitTrackerData');
  if (savedData) {
    const parsedData = JSON.parse(savedData);
    state.habits = parsedData.habits || [];
    state.habits.forEach(h => {
      if (typeof h.lastFailed === 'undefined') h.lastFailed = null;
    });
    state.currentDay = parsedData.currentDay || 1;
    state.dayHistory = parsedData.dayHistory || {};
    state.undoStack = parsedData.undoStack || [];
    state.redoStack = parsedData.redoStack || [];
    currentDayEl.textContent = `Day ${state.currentDay}`;
  }
}

function saveData() {
  localStorage.setItem('habitTrackerData', JSON.stringify({
    habits: state.habits,
    currentDay: state.currentDay,
    dayHistory: state.dayHistory,
    undoStack: state.undoStack,
    redoStack: state.redoStack
  }));
}

// ----------------------------
// Event Handlers Initialization
// ----------------------------
function initializeEventListeners() {
  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
      });
      if (tabId === 'chart') updateChart();
      if (tabId === 'table') updateTable();
    });
  });

  // Habit Suggestions (assumes habitSuggestions array exists from suggestions.js)
  habitNameInput.addEventListener('input', () => {
    const value = habitNameInput.value.trim().toLowerCase();
    if (value.length < 1) {
      habitSuggestionsEl.style.display = 'none';
      return;
    }
    const matching = habitSuggestions.filter(s => s.toLowerCase().startsWith(value));
    const nonMatching = habitSuggestions.filter(s => !s.toLowerCase().startsWith(value) && s.toLowerCase().includes(value));
    const filtered = [...matching, ...nonMatching];
    
    if (filtered.length > 0) {
      habitSuggestionsEl.innerHTML = '';
      filtered.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = suggestion;
        item.addEventListener('click', () => {
          habitNameInput.value = suggestion;
          habitSuggestionsEl.style.display = 'none';
        });
        habitSuggestionsEl.appendChild(item);
      });
      habitSuggestionsEl.style.display = 'block';
    } else {
      habitSuggestionsEl.style.display = 'none';
    }
  });
  
  document.addEventListener('click', (e) => {
    if (e.target !== habitNameInput && e.target !== habitSuggestionsEl) {
      habitSuggestionsEl.style.display = 'none';
    }
  });

  // Add Habit
  addHabitBtn.addEventListener('click', () => {
    const habitName = habitNameInput.value.trim();
    if (habitName) {
      addHabit(habitName);
      habitNameInput.value = '';
      habitNameInput.focus();
      habitSuggestionsEl.style.display = 'none';
    }
  });
  habitNameInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') addHabitBtn.click();
  });

  // Submit Day
  submitDayBtn.addEventListener('click', submitDay);

  // Undo/Redo with confirmation
  undoDayBtn.addEventListener('click', () => {
    showModal("Undo Submission", "Are you sure you want to undo the last submission?", "Undo", "Cancel", undoDay);
  });
  redoDayBtn.addEventListener('click', () => {
    showModal("Redo Submission", "Are you sure you want to redo the next submission?", "Redo", "Cancel", redoDay);
  });

  // Table search and sort
  tableSearch.addEventListener('input', updateTable);
  resetFiltersBtn.addEventListener('click', () => {
    tableSearch.value = '';
    state.sortField = 'name';
    state.sortDirection = 'asc';
    updateTable();
  });
  tableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const field = header.getAttribute('data-sort');
      state.sortDirection = (state.sortField === field && state.sortDirection === 'asc') ? 'desc' : 'asc';
      state.sortField = field;
      updateTable();
    });
  });

  // Restart
  restartBtn.addEventListener('click', () => {
    showModal("Restart Tracking", "Are you sure you want to restart? All your habit tracking data will be permanently erased.", "Restart", "Cancel", () => {
      localStorage.clear();
      location.reload();
    });
  });

  // Select/Deselect habits
  selectAllHabitsBtn.addEventListener('click', () => {
    state.habits.forEach(habit => habit.completed = true);
    state.lastCompletionRate = null;
    saveData();
    renderHabits();
    updateCompletionRate();
  });
  deselectAllHabitsBtn.addEventListener('click', () => {
    state.habits.forEach(habit => habit.completed = false);
    state.lastCompletionRate = null;
    saveData();
    renderHabits();
    updateCompletionRate();
  });

  // Chart controls
  selectAllChartBtn.addEventListener('click', () => {
    state.habits.forEach(habit => chartLineVisibility[habit.name] = true);
    updateChart();
  });
  deselectAllChartBtn.addEventListener('click', () => {
    state.habits.forEach(habit => chartLineVisibility[habit.name] = false);
    updateChart();
  });

  // Chart type switch
  if (streakChartBtn && completionChartBtn && failChartBtn) {
    streakChartBtn.addEventListener('click', () => {
      currentChartType = "streak";
      streakChartBtn.classList.add('active');
      completionChartBtn.classList.remove('active');
      failChartBtn.classList.remove('active');
      document.getElementById('chartTitle').textContent = "Streak Progress";
      updateChart();
    });
    completionChartBtn.addEventListener('click', () => {
      currentChartType = "completion";
      completionChartBtn.classList.add('active');
      streakChartBtn.classList.remove('active');
      failChartBtn.classList.remove('active');
      document.getElementById('chartTitle').textContent = "Completion Rate";
      updateChart();
    });
    failChartBtn.addEventListener('click', () => {
      currentChartType = "fail";
      failChartBtn.classList.add('active');
      streakChartBtn.classList.remove('active');
      completionChartBtn.classList.remove('active');
      document.getElementById('chartTitle').textContent = "Days Since Failure";
      updateChart();
    });
  }
}

// ----------------------------
// Habit Management Functions
// ----------------------------
function addHabit(name) {
  if (state.habits.some(habit => habit.name.toLowerCase() === name.toLowerCase())) {
    showModal("Duplicate Habit", "This habit already exists.", "OK");
    return;
  }
  const newHabit = {
    id: Date.now().toString(),
    name,
    streak: 0,
    lastCompleted: null,
    lastFailed: null,
    completed: false,
    history: {},
    missedDays: 0,
    startDay: state.currentDay
  };
  state.habits.push(newHabit);
  saveData();
  renderHabits();
}

function editHabitName(habitId) {
  state.editingHabitId = habitId;
  renderHabits();
}

function saveEditedHabitName(habitId, newName) {
  if (state.habits.some(h => h.id !== habitId && h.name.toLowerCase() === newName.toLowerCase())) {
    showModal("Duplicate Habit", "A habit with this name already exists.", "OK");
    return false;
  }
  const habit = state.habits.find(h => h.id === habitId);
  if (habit) {
    habit.name = newName;
    saveData();
  }
  state.editingHabitId = null;
  return true;
}

function cancelEditing() {
  state.editingHabitId = null;
  renderHabits();
}

function deleteHabit(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;
  showModal("Delete Habit", `Are you sure you want to delete "${habit.name}"?`, "Delete", "Cancel", () => {
    state.habits = state.habits.filter(h => h.id !== habitId);
    saveData();
    renderHabits();
    updateTable();
    updateChart();
  });
}

// ----------------------------
// Rendering Functions
// ----------------------------
function renderHabits() {
  habitsListEl.innerHTML = '';
  if (state.habits.length === 0) {
    habitsListEl.innerHTML = '<p style="text-align: center; margin-top: 20px;">No habits added yet. Add your first habit above!</p>';
    return;
  }
  
  const sortedHabits = state.habits.slice().sort((a, b) => {
    const aMissed = (state.currentDay > 1 && a.history[state.currentDay - 1] === false && a.streak > 0);
    const bMissed = (state.currentDay > 1 && b.history[state.currentDay - 1] === false && b.streak > 0);
    if (aMissed !== bMissed) return aMissed ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  sortedHabits.forEach(habit => {
    const habitEl = document.createElement('div');
    habitEl.className = 'habit-item';
    if (state.currentDay > 1 && habit.history[state.currentDay - 1] === false && habit.streak > 0) {
      habitEl.classList.add('missed');
    }
    if (state.editingHabitId === habit.id) {
      habitEl.innerHTML = `
        <div class="habit-check">
          <label class="custom-checkbox">
            <input type="checkbox" id="habit-${habit.id}" ${habit.completed ? 'checked' : ''} disabled>
            <span class="checkmark"></span>
          </label>
        </div>
        <div class="edit-mode">
          <input type="text" id="edit-${habit.id}" value="${habit.name}">
          <button class="save-edit" data-id="${habit.id}">Save</button>
          <button class="cancel-edit">Cancel</button>
        </div>
      `;
      setTimeout(() => {
        const input = habitEl.querySelector(`#edit-${habit.id}`);
        input.focus();
        input.select();
      }, 0);
      const saveBtn = habitEl.querySelector('.save-edit');
      saveBtn.addEventListener('click', () => {
        const newName = habitEl.querySelector(`#edit-${habit.id}`).value.trim();
        if (newName && saveEditedHabitName(habit.id, newName)) renderHabits();
      });
      const cancelBtn = habitEl.querySelector('.cancel-edit');
      cancelBtn.addEventListener('click', cancelEditing);
      habitEl.querySelector(`#edit-${habit.id}`).addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveBtn.click();
        else if (e.key === 'Escape') cancelBtn.click();
      });
    } else {
      habitEl.innerHTML = `
        <div class="habit-check">
          <label class="custom-checkbox">
            <input type="checkbox" id="habit-${habit.id}" ${habit.completed ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
        </div>
        <div class="habit-info">
          <span class="habit-name" data-id="${habit.id}">${habit.name}</span>
        </div>
        <div class="habit-actions">
          <div class="habit-streak">Streak: ${habit.streak}</div>
          <button class="btn-danger" data-id="${habit.id}">Delete</button>
        </div>
      `;
      const checkbox = habitEl.querySelector(`input[type="checkbox"]`);
      checkbox.addEventListener('change', () => {
        habit.completed = checkbox.checked;
        state.lastCompletionRate = null;
        updateCompletionRate();
        saveData();
      });
      habitEl.querySelector('.habit-name').addEventListener('click', (e) => {
        e.stopPropagation();
        editHabitName(habit.id);
      });
      habitEl.addEventListener('click', (e) => {
        if (e.target.closest('.habit-name') || e.target.closest('.btn-danger') || e.target.closest('.custom-checkbox')) return;
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });
      habitEl.querySelector('.btn-danger').addEventListener('click', () => deleteHabit(habit.id));
    }
    habitsListEl.appendChild(habitEl);
  });
  updateCompletionRate();
}

function updateTable() {
  tableBodyEl.innerHTML = '';
  const searchTerm = tableSearch.value.toLowerCase();
  const filteredHabits = state.habits.filter(habit => habit.name.toLowerCase().includes(searchTerm));
  filteredHabits.sort((a, b) => {
    let aVal, bVal;
    switch (state.sortField) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'streak':
        aVal = a.streak;
        bVal = b.streak;
        break;
      case 'completion': {
        const aDays = state.currentDay - a.startDay;
        const bDays = state.currentDay - b.startDay;
        const aCompleted = aDays > 0 ? getCompletedDays(a) / aDays : 0;
        const bCompleted = bDays > 0 ? getCompletedDays(b) / bDays : 0;
        aVal = aCompleted;
        bVal = bCompleted;
        break;
      }
      case 'lastCompleted':
        aVal = a.lastCompleted || 0;
        bVal = b.lastCompleted || 0;
        break;
      case 'lastFailed':
        aVal = a.lastFailed || 0;
        bVal = b.lastFailed || 0;
        break;
      default:
        aVal = 0;
        bVal = 0;
    }
    if (typeof aVal === 'string') {
      return state.sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    } else {
      return state.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
  });

  filteredHabits.forEach(habit => {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = habit.name;
    row.appendChild(nameCell);
    
    const streakCell = document.createElement('td');
    streakCell.textContent = habit.streak;
    row.appendChild(streakCell);
    
    const habitDays = state.currentDay - habit.startDay;
    const completedDays = getCompletedDays(habit);
    const completionRate = habitDays > 0 ? Math.round((completedDays / habitDays) * 100) : 'N/A';
    
    const completionCell = document.createElement('td');
    completionCell.textContent = habitDays > 0 ? `${completionRate}%` : 'N/A';
    row.appendChild(completionCell);
    
    const lastFailedCell = document.createElement('td');
    let lastFailedText = 'Never';
    if (habit.lastFailed) {
      const diffFail = state.currentDay - habit.lastFailed - 1;
      lastFailedText = diffFail <= 0 ? 'Today' : `${diffFail} day${diffFail === 1 ? '' : 's'} ago`;
    }
    lastFailedCell.textContent = lastFailedText;
    row.appendChild(lastFailedCell);

    const lastCompletedCell = document.createElement('td');
    let lastCompletedText = 'Never';
    if (habit.lastCompleted) {
      const diff = state.currentDay - habit.lastCompleted - 1;
      lastCompletedText = diff <= 0 ? 'Today' : `${diff} day${diff === 1 ? '' : 's'} ago`;
    }
    lastCompletedCell.textContent = lastCompletedText;
    row.appendChild(lastCompletedCell);
    
    tableBodyEl.appendChild(row);
  });
  
  // Append average row
  const count = filteredHabits.length;
  let sumStreak = 0, sumCompletion = 0, sumLastCompleted = 0, sumLastFailed = 0;
  filteredHabits.forEach(habit => {
    sumStreak += habit.streak;
    const habitDays = state.currentDay - habit.startDay;
    const habitCompletedDays = getCompletedDays(habit);
    const habitCompletion = habitDays > 0 ? (habitCompletedDays / habitDays * 100) : 0;
    sumCompletion += habitCompletion;
    const diffCompleted = habit.lastCompleted ? state.currentDay - habit.lastCompleted - 1 : state.currentDay - habit.startDay;
    sumLastCompleted += diffCompleted;
    const diffFailed = habit.lastFailed ? state.currentDay - habit.lastFailed - 1 : state.currentDay - habit.startDay;
    sumLastFailed += diffFailed;
  });
  const avgStreak = count > 0 ? Math.round(sumStreak / count) : 0;
  const avgCompletion = count > 0 ? Math.round(sumCompletion / count) : 0;
  const avgLastCompletedNum = count > 0 ? Math.round(sumLastCompleted / count) : 0;
  const avgLastCompletedText = avgLastCompletedNum <= 0 ? 'Today' : `${avgLastCompletedNum} day${avgLastCompletedNum === 1 ? '' : 's'} ago`;
  const avgLastFailedNum = count > 0 ? Math.round(sumLastFailed / count) : 0;
  const avgLastFailedText = avgLastFailedNum <= 0 ? 'Today' : `${avgLastFailedNum} day${avgLastFailedNum === 1 ? '' : 's'} ago`;
  
  const avgRow = document.createElement('tr');
  avgRow.classList.add('average-row');
  avgRow.innerHTML = `
    <td>Average</td>
    <td>${avgStreak}</td>
    <td>${filteredHabits.length > 0 ? `${avgCompletion}%` : 'N/A'}</td>
    <td>${avgLastFailedText}</td>
    <td>${avgLastCompletedText}</td>
  `;
  tableBodyEl.appendChild(avgRow);

  // Update sort icons
  tableHeaders.forEach(header => {
    const field = header.getAttribute('data-sort');
    const iconSpan = header.querySelector('.sort-icon');
    iconSpan.textContent = field === state.sortField ? (state.sortDirection === 'asc' ? '▲' : '▼') : '⇅';
  });
}

// ----------------------------
// Chart Functions (D3.js)
// ----------------------------
function updateChart() {
  const submittedDays = state.currentDay - 1;
  if (submittedDays < 1) return;

  const container = d3.select("#streakChart");
let svg = container.select("svg");
let g;
const containerWidth = container.node().clientWidth;
const containerHeight = 500;

if (svg.empty()) {
  svg = container.append("svg")
    .style("font-family", "Open Sans, sans-serif")
    .style("font-size", "14px")
    .style("color", "#444");

  // Drop shadow filter
  const defs = svg.append("defs");
  defs.append("filter")
    .attr("id", "dropShadow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%")
    .html(`
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
      <feOffset in="blur" dx="2" dy="2" result="offsetBlur"/>
      <feMerge>
        <feMergeNode in="offsetBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    `);
  g = svg.append("g")
    .attr("class", "chart-content")
    .attr("transform", "translate(40,20)");
} else {
  g = svg.select("g.chart-content");
}

// NEW: Update the SVG dimensions each time updateChart() is called.
svg.attr("width", containerWidth)
   .attr("height", containerHeight);

  // Compute datasets based on chart type
  let datasets = [];
  if (currentChartType === "streak") {
    datasets = state.habits.map((habit, index) => {
      const hue = (index * 137) % 360;
      let data = [];
      let currentStreak = 0;
      for (let day = 1; day <= submittedDays; day++) {
        if (day < habit.startDay) {
          data.push(null);
        } else {
          if (habit.history[day]) {
            currentStreak++;
          } else if (habit.history[day] === false && currentStreak > 0) {
            if (day > habit.startDay && !habit.history[day - 1]) currentStreak = 0;
          }
          data.push(currentStreak);
        }
      }
      return { label: habit.name, data, hue, isAverage: false };
    });
    // Average streak
    let avgData = [];
    for (let day = 1; day <= submittedDays; day++) {
      let sum = 0, count = 0;
      state.habits.forEach(habit => {
        if (day >= habit.startDay) {
          let streak = 0;
          for (let d = habit.startDay; d <= day; d++) {
            if (habit.history[d]) streak++;
            else if (habit.history[d] === false && streak > 0) {
              if (d > habit.startDay && !habit.history[d - 1]) streak = 0;
            }
          }
          sum += streak;
          count++;
        }
      });
      avgData.push(count > 0 ? sum / count : null);
    }
    datasets.push({ label: "Average", displayLabel: "Average Streak", data: avgData, hue: null, isAverage: true });
  } else if (currentChartType === "completion") {
    datasets = state.habits.map((habit, index) => {
      const hue = (index * 137) % 360;
      let data = [];
      for (let day = 1; day <= submittedDays; day++) {
        if (day < habit.startDay) {
          data.push(null);
        } else {
          let completed = 0;
          for (let d = habit.startDay; d <= day; d++) {
            if (habit.history[d]) completed++;
          }
          const totalDays = day - habit.startDay + 1;
          data.push(Math.round((completed / totalDays) * 100));
        }
      }
      return { label: habit.name, data, hue, isAverage: false };
    });
    // Average completion
    let avgData = [];
    for (let day = 1; day <= submittedDays; day++) {
      let sum = 0, count = 0;
      state.habits.forEach(habit => {
        if (day >= habit.startDay) {
          let completed = 0;
          for (let d = habit.startDay; d <= day; d++) {
            if (habit.history[d]) completed++;
          }
          sum += (completed / (day - habit.startDay + 1)) * 100;
          count++;
        }
      });
      avgData.push(count > 0 ? Math.round(sum / count) : null);
    }
    datasets.push({ label: "Average", displayLabel: "Average Completion", data: avgData, hue: null, isAverage: true });
  } else if (currentChartType === "fail") {
    datasets = state.habits.map((habit, index) => {
      const hue = (index * 137) % 360;
      let data = [];
      let lastFail = null;
      for (let day = 1; day <= submittedDays; day++) {
        if (day < habit.startDay) {
          data.push(null);
        } else {
          if (habit.history[day] === false) lastFail = day;
          let value;
          if (lastFail) {
            value = day - lastFail;
          } else {
            value = day - habit.startDay;
          }
          data.push(value);
        }
      }
      return { label: habit.name, data, hue, isAverage: false };
    });
    // Average days since fail
    let avgData = [];
    for (let day = 1; day <= submittedDays; day++) {
      let sum = 0, count = 0;
      state.habits.forEach(habit => {
        if (day >= habit.startDay) {
          let lastFail = null;
          for (let d = habit.startDay; d <= day; d++) {
            if (habit.history[d] === false) lastFail = d;
          }
          let value;
          if (lastFail) {
            value = day - lastFail;
          } else {
            value = day - habit.startDay;
          }
          sum += value;
          count++;
        }
      });
      avgData.push(count > 0 ? sum / count : null);
    }
    datasets.push({ label: "Average", displayLabel: "Average Days Since Failure", data: avgData, hue: null, isAverage: true });
  }

  // Scales and axes
  const margin = { left: 60, top: 20, right: 20, bottom: 40 };
  const width = containerWidth - margin.left - margin.right;
  const height = containerHeight - margin.top - margin.bottom;
  g.attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain([1, submittedDays]).range([0, width]);
  const visibleDatasets = datasets.filter(ds => ds.isAverage || chartLineVisibility[ds.label] !== false);
  let yMax = d3.max(visibleDatasets, ds => d3.max(ds.data));
  if (!yMax || yMax < 1) yMax = 1;
  const y = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

  // Remove previous axes and grids
  g.selectAll(".x-axis, .y-axis, .x-label, .y-label, .grid, .grid-border").remove();

  // Axes
  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).ticks(submittedDays).tickFormat(d => d));
  g.append("text")
    .attr("class", "x-label")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height + 30)
    .style("font-weight", "500")
    .text("Day");
  g.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y).ticks(currentChartType === "completion" ? 10 : yMax)
      .tickFormat(d => currentChartType === "completion" ? d + "%" : d));
  const xGrid = g.append("g")
    .attr("class", "grid x-grid")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickSize(-height).tickFormat(""));
  xGrid.lower();
  const yGrid = g.append("g")
    .attr("class", "grid y-grid")
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));
  yGrid.lower();
  g.insert("rect", ":first-child")
    .attr("class", "grid-border")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .attr("stroke", "#ccc")
    .attr("stroke-width", 1);
  g.append("text")
    .attr("class", "y-label")
    .attr("transform", "rotate(-90)")
    .attr("y", -35)
    .attr("x", -height / 2)
    .style("text-anchor", "middle")
    .style("font-weight", "500")
    .text(currentChartType === "streak" ? "Streak Count" : currentChartType === "completion" ? "Completion Rate (%)" : "Days Since Failure");

  // Tooltip setup
  let tooltip = d3.select("#tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "tooltip")
      .attr("class", "tooltip")
      .style("opacity", 0);
  }
  // Hide tooltip when chart is redrawn to prevent stale hover info
  tooltip.style("opacity", 0);

  // Data join for line groups
  let lineGroups = g.selectAll(".line-group").data(datasets, d => d.label);
  lineGroups.exit().transition().duration(500).style("opacity", 0).remove();
  const lineGroupsEnter = lineGroups.enter().append("g")
    .attr("class", "line-group")
    .style("opacity", 0)
    .style("pointer-events", "auto");
  lineGroups = lineGroupsEnter.merge(lineGroups);
  lineGroups.transition().duration(500)
    .style("opacity", d => chartLineVisibility[d.label] === false ? 0 : 1)
    .style("pointer-events", d => chartLineVisibility[d.label] === false ? "none" : "auto");

  const lineGenerator = d3.line()
    .defined(d => d !== null)
    .x((d, i) => x(i + 1))
    .y(d => y(d))
    .curve(d3.curveMonotoneX);

  let paths = lineGroups.selectAll("path.line-path").data(d => [d]);
  paths.exit().remove();
  const pathsEnter = paths.enter().append("path")
    .attr("class", "line-path")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 3)
    .attr("stroke-dasharray", d => d.isAverage ? "4,5" : null)
    .attr("d", d => lineGenerator(d.data))
    .style("opacity", 0);
  paths = pathsEnter.merge(paths);
  paths.transition().duration(175)
    .attr("stroke", d => d.isAverage ? "black" : `hsl(${d.hue},70%,60%)`)
    .style("opacity", 1)
    .attr("d", d => lineGenerator(d.data));

  // Invisible overlay for mouse interaction
  let overlay = lineGroups.selectAll("path.line-overlay").data(d => [d]);
  overlay.exit().remove();
  const overlayEnter = overlay.enter().append("path")
    .attr("class", "line-overlay")
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 15)
    .attr("d", d => lineGenerator(d.data));
  overlay = overlayEnter.merge(overlay)
    .attr("stroke-width", 15)
    .attr("d", d => lineGenerator(d.data));
  overlay.on("mousemove", function(event, d) {
    const pointer = d3.pointer(event, g.node());
    let approxDay = x.invert(pointer[0]);
    let nearestIndex = Math.round(approxDay) - 1;
    nearestIndex = Math.max(0, Math.min(nearestIndex, d.data.length - 1));
    const value = d.data[nearestIndex];
    const metric = currentChartType === "streak" ? "Streak" : currentChartType === "completion" ? "Completion" : "Days Since Fail";
    const info = `
      <div style="font-weight: bold; font-size: 17px;">${d.label}</div>
      <div>Day: ${nearestIndex + 1}</div>
      <div>${metric}: ${value !== null ? value.toFixed(1) : 'N/A'}</div>
    `;
    tooltip.html(info)
      .transition().duration(200).style("opacity", 0.9);
    tooltip.style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
  })
  .on("mouseout", () => {
    tooltip.transition().duration(500).style("opacity", 0);
  });

  // Circles for data points
  let circleGroups = lineGroups.selectAll("circle.line-circle")
    .data(d => d.data.map((val, i) => ({
      val,
      dayIndex: i + 1,
      label: d.label,
      hue: d.hue,
      isAverage: d.isAverage
    })));
  circleGroups.exit().transition().duration(500).attr("r", 0).remove();
  const circleEnter = circleGroups.enter().append("circle")
    .attr("class", "line-circle")
    .attr("r", 0)
    .attr("fill", d => d.isAverage ? "#000" : `hsl(${d.hue},70%,60%)`)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mouseover", (event, d) => {
      if (d.val !== null) {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`
          <div style="font-weight: bold; font-size: 17px;">${d.label}</div>
          <div>Day: ${d.dayIndex}</div>
          <div>${currentChartType === "streak" ? "Streak" :
            currentChartType === "completion" ? "Completion" :
            "Days Since Fail"}: ${d.val.toFixed(1)}</div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
      }
    })
    .on("mousemove", (event) => {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
      tooltip.transition().duration(500).style("opacity", 0);
    });
  circleGroups = circleEnter.merge(circleGroups);
  circleGroups.transition().duration(500)
    .attr("cx", d => d.val !== null ? x(d.dayIndex) : 0)
    .attr("cy", d => d.val !== null ? y(d.val) : 0)
    .attr("r", d => d.val !== null ? 6 : 0);

  // Legend
  const legendContainer = d3.select("#legendContainer");
  legendContainer.selectAll("*").remove();
  legendContainer.style("display", "flex")
    .style("justify-content", "center")
    .style("flex-wrap", "wrap")
    .style("margin", "10px 0");

  // Habit legends (non-average)
  const habitLegendData = datasets.filter(ds => !ds.isAverage).sort((a, b) => a.label.localeCompare(b.label));
  const legendItems = legendContainer.selectAll(".legend-item.habit").data(habitLegendData, d => d.label);
  legendItems.exit().remove();
  const legendEnter = legendItems.enter().append("div")
    .attr("class", "legend-item habit")
    .style("display", "inline-flex")
    .style("align-items", "center")
    .style("margin-right", "15px")
    .style("cursor", "pointer")
    .style("border-radius", "4px")
    .style("padding", "2px 6px")
    .style("font-size", "16px")
    .style("font-weight", "500")
    .style("color", "#333")
    .style("background-color", "transparent")
    .style("transition", "all 0.2s ease")
    .on("click", (event, d) => {
      chartLineVisibility[d.label] = !(chartLineVisibility[d.label] !== false);
      updateChart();
    })
    .on("mouseover", function() {
      d3.select(this).style("font-weight", "600")
        .style("color", "#000")
        .style("background-color", "#f2f2f2");
    })
    .on("mouseout", function() {
      d3.select(this).style("font-weight", "500")
        .style("color", "#333")
        .style("background-color", "transparent");
    });
  legendEnter.append("span")
    .style("display", "inline-block")
    .style("width", "14px")
    .style("height", "14px")
    .style("border-radius", "50%")
    .style("margin-right", "6px")
    .style("background-color", d => `hsl(${d.hue},70%,60%)`);
  legendEnter.append("span")
    .attr("class", "legend-text")
    .style("font-weight", "inherit")
    .style("font-size", "inherit")
    .style("color", "inherit")
    .style("transform", "translateY(-2px)");
  const legendAll = legendEnter.merge(legendItems);
  legendAll.select(".legend-text")
    .text(d => d.label)
    .classed("strikethrough", d => chartLineVisibility[d.label] === false)
    .style("opacity", 1);

  // Average legend
  // Average legend
const avgLegendData = datasets.filter(ds => ds.isAverage);
const avgLegendItems = legendContainer.selectAll(".legend-item.average").data(avgLegendData, d => d.label);
avgLegendItems.exit().remove();
const avgLegendEnter = avgLegendItems.enter().append("div")
  .attr("class", "legend-item average")
  .style("display", "inline-flex")
  .style("align-items", "center")
  .style("margin-right", "15px")
  .style("cursor", "pointer")  // Changed to pointer for interactivity
  .style("border-radius", "4px")
  .style("padding", "2px 6px")
  .style("font-size", "14px")
  .style("font-weight", "500")
  .style("color", "#333")
  .style("background-color", "transparent")
  .style("transition", "all 0.2s ease")
  .on("click", (event, d) => {  // Added click event to toggle visibility
    chartLineVisibility[d.label] = !(chartLineVisibility[d.label] !== false);
    updateChart();
  })
  .on("mouseover", function() {
    d3.select(this).style("font-weight", "600")
      .style("color", "#000")
      .style("background-color", "#f2f2f2");
  })
  .on("mouseout", function() {
    d3.select(this).style("font-weight", "500")
      .style("color", "#333")
      .style("background-color", "transparent");
  });
avgLegendEnter.append("span")
  .style("display", "inline-block")
  .style("width", "14px")
  .style("height", "14px")
  .style("border-radius", "50%")
  .style("margin-right", "6px")
  .style("background-color", "black");
avgLegendEnter.append("span")
  .attr("class", "legend-text")
  .style("font-weight", "inherit")
  .style("font-size", "inherit")
  .style("color", "inherit")
  .style("transform", "translateY(-2px)");
const avgLegendAll = avgLegendEnter.merge(avgLegendItems);
avgLegendAll.select(".legend-text")
  .text(d => d.label)
  .classed("strikethrough", d => chartLineVisibility[d.label] === false)
  .style("opacity", 1);
}

// ----------------------------
// Day Submission, Undo, Redo
// ----------------------------
function submitDay() {
  state.undoStack.push({
    habits: deepClone(state.habits),
    currentDay: state.currentDay,
    dayHistory: deepClone(state.dayHistory)
  });
  state.redoStack = [];
  
  const completedCount = state.habits.filter(habit => habit.completed).length;
  state.lastCompletionRate = Math.round((completedCount / state.habits.length) * 100);
  
  state.dayHistory[state.currentDay] = state.habits.map(habit => ({ id: habit.id, completed: habit.completed }));
  state.habits.forEach(habit => {
    habit.history[state.currentDay] = habit.completed;
    if (habit.completed) {
      habit.streak++;
      habit.lastCompleted = state.currentDay;
      habit.missedDays = 0;
    } else {
      habit.missedDays++;
      habit.lastFailed = state.currentDay;
      if (habit.missedDays > 1) habit.streak = 0;
    }
    habit.completed = false;
  });
  state.currentDay++;
  currentDayEl.textContent = `Day ${state.currentDay}`;
  saveData();
  renderHabits();
  updateChart();
}

function undoDay() {
  if (state.undoStack.length > 0) {
    state.redoStack.push({
      habits: deepClone(state.habits),
      currentDay: state.currentDay,
      dayHistory: deepClone(state.dayHistory)
    });
    const previousState = state.undoStack.pop();
    state.habits = previousState.habits;
    state.currentDay = previousState.currentDay;
    state.dayHistory = previousState.dayHistory;
    currentDayEl.textContent = `Day ${state.currentDay}`;
    saveData();
    renderHabits();
    updateTable();
    updateChart();
  } else {
    showModal("Undo", "No submission to undo.", "OK");
  }
}

function redoDay() {
  if (state.redoStack.length > 0) {
    state.undoStack.push({
      habits: deepClone(state.habits),
      currentDay: state.currentDay,
      dayHistory: deepClone(state.dayHistory)
    });
    const nextState = state.redoStack.pop();
    state.habits = nextState.habits;
    state.currentDay = nextState.currentDay;
    state.dayHistory = nextState.dayHistory;
    currentDayEl.textContent = `Day ${state.currentDay}`;
    saveData();
    renderHabits();
    updateTable();
    updateChart();
  } else {
    showModal("Redo", "No submission to redo.", "OK");
  }
}

// ----------------------------
// Initialization
// ----------------------------
loadData();
initializeEventListeners();
renderHabits();
