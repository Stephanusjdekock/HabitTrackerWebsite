// App state
const state = {
  habits: [],
  currentDay: 1,
  dayHistory: {},
  sortField: 'name',
  sortDirection: 'asc',
  editingHabitId: null,
  lastCompletionRate: null,
  undoStack: [], // Multi-level undo
  redoStack: []  // Redo functionality
};

// DOM elements
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

// Select/Deselect buttons
const selectAllHabitsBtn = document.getElementById('selectAllHabits');
const deselectAllHabitsBtn = document.getElementById('deselectAllHabits');
const selectAllChartBtn = document.getElementById('selectAllChart');
const deselectAllChartBtn = document.getElementById('deselectAllChart');

// Initialize chart
let streakChart;

// Load data from localStorage if available
function loadData() {
  const savedData = localStorage.getItem('habitTrackerData');
  if (savedData) {
    const parsedData = JSON.parse(savedData);
    state.habits = parsedData.habits || [];
    state.currentDay = parsedData.currentDay || 1;
    state.dayHistory = parsedData.dayHistory || {};
    state.undoStack = parsedData.undoStack || [];  // NEW: Load undo history
    state.redoStack = parsedData.redoStack || [];    // NEW: Load redo history
    currentDayEl.textContent = `Day ${state.currentDay}`;
  }
}


// Save data to localStorage
function saveData() {
  localStorage.setItem('habitTrackerData', JSON.stringify({
    habits: state.habits,
    currentDay: state.currentDay,
    dayHistory: state.dayHistory,
    undoStack: state.undoStack,  // NEW: Save undo history
    redoStack: state.redoStack     // NEW: Save redo history
  }));
}


// Modal dialog functions
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
  
  modalContainer.appendChild(modalHeader);
  modalContainer.appendChild(modalBody);
  modalContainer.appendChild(modalFooter);
  modalOverlay.appendChild(modalContainer);
  
  document.body.appendChild(modalOverlay);
  
  const style = document.createElement('style');
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

function removeModal() {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();
}

// Update completion rate display
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

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabId = tab.getAttribute('data-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === tabId) content.classList.add('active');
    });
    if (tabId === 'chart') updateChart();
    if (tabId === 'table') updateTable();
  });
});

// Habit suggestions
habitNameInput.addEventListener('input', () => {
  const value = habitNameInput.value.trim().toLowerCase();
  if (value.length < 1) {
    habitSuggestionsEl.style.display = 'none';
    return;
  }
  const matching = habitSuggestions.filter(suggestion => suggestion.toLowerCase().startsWith(value));
  const nonMatching = habitSuggestions.filter(suggestion =>
    !suggestion.toLowerCase().startsWith(value) && suggestion.toLowerCase().includes(value)
  );
  const filtered = matching.concat(nonMatching);
  
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

// Hide suggestions on outside click
document.addEventListener('click', (e) => {
  if (e.target !== habitNameInput && e.target !== habitSuggestionsEl) {
    habitSuggestionsEl.style.display = 'none';
  }
});

// Add a new habit
addHabitBtn.addEventListener('click', () => {
  const habitName = habitNameInput.value.trim();
  if (habitName) {
    addHabit(habitName);
    habitNameInput.value = '';
    habitNameInput.focus();
    habitSuggestionsEl.style.display = 'none';
  }
});
habitNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addHabitBtn.click();
});

// Submit day
submitDayBtn.addEventListener('click', () => submitDay());

// Undo submission with confirmation
undoDayBtn.addEventListener('click', () => {
  showModal(
    "Undo Submission",
    "Are you sure you want to undo the last submission?",
    "Undo",
    "Cancel",
    () => { undoDay(); }
  );
});

// Redo submission with confirmation
redoDayBtn.addEventListener('click', () => {
  showModal(
    "Redo Submission",
    "Are you sure you want to redo the next submission?",
    "Redo",
    "Cancel",
    () => { redoDay(); }
  );
});

// Table search and sorting
tableSearch.addEventListener('input', () => updateTable());
resetFiltersBtn.addEventListener('click', () => {
  tableSearch.value = '';
  state.sortField = 'name';
  state.sortDirection = 'asc';
  updateTable();
});
tableHeaders.forEach(header => {
  header.addEventListener('click', () => {
    const field = header.getAttribute('data-sort');
    state.sortField = field;
    state.sortDirection = state.sortField === field ? (state.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
    updateTable();
  });
});

// Restart functionality with confirmation
restartBtn.addEventListener('click', () => {
  showModal(
    "Restart Tracking",
    "Are you sure you want to restart? All your habit tracking data will be permanently erased.",
    "Restart",
    "Cancel",
    () => { localStorage.clear(); location.reload(); }
  );
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

// Chart "All" and "Clear" buttons with smooth fade transitions
selectAllChartBtn.addEventListener('click', () => {
  if (streakChart) {
    streakChart.data.datasets.forEach(dataset => {
      if (dataset.label !== "Average Streak") {
        dataset.opacity = 1;
        let hue = dataset.hue;
        dataset.borderColor = `hsla(${hue}, 70%, 60%, 1)`;
        dataset.backgroundColor = `hsla(${hue}, 70%, 60%, 1)`;
      }
    });
    streakChart.update({duration: 500, easing: 'easeInOutQuad'});
  }
});
deselectAllChartBtn.addEventListener('click', () => {
  if (streakChart) {
    streakChart.data.datasets.forEach(dataset => {
      if (dataset.label !== "Average Streak") {
        dataset.opacity = 0;
        let hue = dataset.hue;
        dataset.borderColor = `hsla(${hue}, 70%, 60%, 0)`;
        dataset.backgroundColor = `hsla(${hue}, 70%, 60%, 0)`;
      }
    });
    streakChart.update({duration: 500, easing: 'easeInOutQuad'});
  }
});

// Add a new habit function
function addHabit(name) {
  if (state.habits.some(habit => habit.name.toLowerCase() === name.toLowerCase())) {
    showModal("Duplicate Habit", "This habit already exists.", "OK");
    return;
  }
  const newHabit = {
    id: Date.now().toString(),
    name: name,
    streak: 0,
    lastCompleted: null,
    completed: false,
    history: {},
    missedDays: 0,
    startDay: state.currentDay
  };
  state.habits.push(newHabit);
  saveData();
  renderHabits();
}

// Edit habit functions
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
  if (habit) { habit.name = newName; saveData(); }
  state.editingHabitId = null;
  return true;
}
function cancelEditing() {
  state.editingHabitId = null;
  renderHabits();
}

// Render habits list
function renderHabits() {
  habitsListEl.innerHTML = '';
  if (state.habits.length === 0) {
    habitsListEl.innerHTML = '<p style="text-align: center; margin-top: 20px;">No habits added yet. Add your first habit above!</p>';
    return;
  }
const sortedHabits = state.habits.slice().sort((a, b) => {
  let aMissed = false, bMissed = false;
  if (state.currentDay > 1) {
    aMissed = (a.history[state.currentDay - 1] === false);
    bMissed = (b.history[state.currentDay - 1] === false);
    // If a habit's streak is 0, treat it as not missed
    if (a.streak === 0) aMissed = false;
    if (b.streak === 0) bMissed = false;
  }
  if (aMissed !== bMissed) return aMissed ? -1 : 1;
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
});

  sortedHabits.forEach(habit => {
    const habitEl = document.createElement('div');
    habitEl.className = 'habit-item';
    // If yesterday was missed, mark red:
     if (state.currentDay > 1 && habit.history[state.currentDay - 1] === false) {
        habitEl.classList.add('missed');
      }

// 3) If the habit streak is 0, remove 'missed' so it returns to normal (green).
     if (habit.streak === 0) {
        habitEl.classList.remove('missed');
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
      const input = habitEl.querySelector(`#edit-${habit.id}`);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveBtn.click();
        else if (e.key === 'Escape') cancelBtn.click();
      });
    } else {
      // Habit row markup with three parts: check, info, and actions
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
      // Only clicking on the habit-name triggers editing
      const habitNameEl = habitEl.querySelector('.habit-name');
      habitNameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        editHabitName(habit.id);
      });
      // Clicking elsewhere in the row (except on name, delete, or checkbox) toggles the checkbox
      habitEl.addEventListener('click', (e) => {
        if (e.target.closest('.habit-name') || e.target.closest('.btn-danger') || e.target.closest('.custom-checkbox')) return;
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });
      const deleteBtn = habitEl.querySelector('.btn-danger');
      deleteBtn.addEventListener('click', () => deleteHabit(habit.id));
    }
    habitsListEl.appendChild(habitEl);
  });
  updateCompletionRate();
}

// Delete habit with confirmation
function deleteHabit(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;
  showModal(
    "Delete Habit",
    `Are you sure you want to delete "${habit.name}"?`,
    "Delete",
    "Cancel",
    () => {
      state.habits = state.habits.filter(h => h.id !== habitId);
      saveData();
      renderHabits();
      updateTable();
      updateChart();
    }
  );
}

// Submit day and update history
function submitDay() {
  state.undoStack.push({
    habits: JSON.parse(JSON.stringify(state.habits)),
    currentDay: state.currentDay,
    dayHistory: JSON.parse(JSON.stringify(state.dayHistory))
  });
  state.redoStack = [];
  
  const completedCount = state.habits.filter(habit => habit.completed).length;
  state.lastCompletionRate = Math.round((completedCount / state.habits.length) * 100);
  
  state.dayHistory[state.currentDay] = state.habits.map(habit => ({
    id: habit.id,
    completed: habit.completed
  }));
  state.habits.forEach(habit => {
    habit.history[state.currentDay] = habit.completed;
    if (habit.completed) {
      habit.streak++;
      habit.lastCompleted = state.currentDay;
      habit.missedDays = 0;
    } else {
      habit.missedDays++;
      if (habit.missedDays > 1) habit.streak = 0;
    }
    habit.completed = false;
  });
  state.currentDay++;
  currentDayEl.textContent = `Day ${state.currentDay}`;
  saveData();
  renderHabits();
}

// Undo last submission (push current state to redo stack)
function undoDay() {
  if (state.undoStack.length > 0) {
    state.redoStack.push({
      habits: JSON.parse(JSON.stringify(state.habits)),
      currentDay: state.currentDay,
      dayHistory: JSON.parse(JSON.stringify(state.dayHistory))
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

// Redo last undone submission (push current state to undo stack)
function redoDay() {
  if (state.redoStack.length > 0) {
    state.undoStack.push({
      habits: JSON.parse(JSON.stringify(state.habits)),
      currentDay: state.currentDay,
      dayHistory: JSON.parse(JSON.stringify(state.dayHistory))
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

// Update chart with smooth opacity transitions
function updateChart() {
  const submittedDays = state.currentDay - 1;
  if (submittedDays < 1) {
    if (streakChart) streakChart.destroy();
    return;
  }
  const ctx = document.getElementById('streakChart').getContext('2d');
  const labels = Array.from({ length: submittedDays }, (_, i) => `Day ${i + 1}`);
  const newDatasets = state.habits.map((habit, index) => {
    const hue = (index * 137) % 360;
    const opacity = (streakChart && streakChart.data.datasets[index] && streakChart.data.datasets[index].opacity !== undefined)
                      ? streakChart.data.datasets[index].opacity : 1;
    const data = [];
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
    return {
      label: habit.name,
      data: data,
      hue: hue,
      opacity: opacity,
      borderColor: `hsla(${hue}, 70%, 60%, ${opacity})`,
      backgroundColor: `hsla(${hue}, 70%, 60%, ${opacity})`,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5
    };
  });
  
  const avgData = [];
  for (let day = 1; day <= submittedDays; day++) {
    let sumStreak = 0, countHabits = 0;
    state.habits.forEach(habit => {
      if (day >= habit.startDay) {
        let currentStreak = 0;
        for (let d = habit.startDay; d <= day; d++) {
          if (habit.history[d]) {
            currentStreak++;
          } else if (habit.history[d] === false && currentStreak > 0) {
            if (d > habit.startDay && !habit.history[d - 1]) currentStreak = 0;
          }
        }
        sumStreak += currentStreak;
        countHabits++;
      }
    });
    avgData.push(countHabits > 0 ? sumStreak / countHabits : null);
  }
  newDatasets.push({
    label: "Average Streak",
    data: avgData,
    borderColor: 'black',
    backgroundColor: 'black',
    borderWidth: 3,
    borderDash: [5, 5],
    tension: 0.3,
    pointRadius: 0
  });
  
  if (streakChart) {
    streakChart.data.labels = labels;
    streakChart.data.datasets = newDatasets;
    streakChart.update({duration: 500, easing: 'easeInOutQuad'});
  } else {
    streakChart = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: newDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeInOutQuad' },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              boxWidth: 10,
              padding: 15,
              font: { size: 14 },
              generateLabels: function(chart) {
                const datasets = chart.data.datasets;
                const legendItems = [];
                datasets.forEach((dataset, i) => {
                  legendItems.push({
                    text: dataset.label,
                    fillStyle: dataset.backgroundColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: 2,
                    hidden: !chart.isDatasetVisible(i),
                    index: i,
                    datasetIndex: i
                  });
                });
                return legendItems;
              }
            },
            onClick: function(e, legendItem, legend) {
              const index = legendItem.datasetIndex;
              const ci = legend.chart;
              if (ci.isDatasetVisible(index)) {
                ci.hide(index);
                legendItem.hidden = true;
              } else {
                ci.show(index);
                legendItem.hidden = false;
              }
            }
          },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Streak Count' },
            ticks: { stepSize: 1 }
          },
          x: { title: { display: true, text: 'Days' } }
        }
      }
    });
  }
}

// Helper for table data
function getCompletedDays(habit) {
  let count = 0;
  for (let d = habit.startDay; d < state.currentDay; d++) {
    if (habit.history[d]) count++;
  }
  return count;
}

// Update table view
function updateTable() {
  tableBodyEl.innerHTML = '';
  const searchTerm = tableSearch.value.toLowerCase();
  let filteredHabits = state.habits.filter(habit =>
    habit.name.toLowerCase().includes(searchTerm)
  );
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
        let aDays = state.currentDay - a.startDay;
        let bDays = state.currentDay - b.startDay;
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
    let completedDays = 0;
    for (let d = habit.startDay; d < state.currentDay; d++) {
      if (habit.history[d]) completedDays++;
    }
    let completionRate = habitDays > 0 ? Math.round((completedDays / habitDays) * 100) : 'N/A';
    
    const completionCell = document.createElement('td');
    completionCell.textContent = habitDays > 0 ? `${completionRate}%` : 'N/A';
    row.appendChild(completionCell);
    
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
  
  let sumStreak = 0, sumCompletion = 0, sumLastCompleted = 0;
  const count = filteredHabits.length;
  filteredHabits.forEach(habit => {
    sumStreak += habit.streak;
    let habitDays = state.currentDay - habit.startDay;
    let habitCompletedDays = 0;
    for (let d = habit.startDay; d < state.currentDay; d++) {
      if (habit.history[d]) habitCompletedDays++;
    }
    let habitCompletion = habitDays > 0 ? (habitCompletedDays / habitDays * 100) : 0;
    sumCompletion += habitCompletion;
    let diff;
    if (habit.lastCompleted) {
      diff = state.currentDay - habit.lastCompleted - 1;
    } else {
      diff = state.currentDay - habit.startDay;
    }
    sumLastCompleted += diff;
  });
  let avgStreak = count > 0 ? Math.round(sumStreak / count) : 0;
  let avgCompletion = count > 0 ? Math.round(sumCompletion / count) : 0;
  let avgLastCompletedNum = count > 0 ? Math.round(sumLastCompleted / count) : 0;
  let avgLastCompletedText = avgLastCompletedNum <= 0 ? 'Today' : `${avgLastCompletedNum} day${avgLastCompletedNum === 1 ? '' : 's'} ago`;
  
  const avgRow = document.createElement('tr');
  avgRow.classList.add('average-row');
  const avgNameCell = document.createElement('td');
  avgNameCell.textContent = 'Average';
  avgRow.appendChild(avgNameCell);
  const avgStreakCell = document.createElement('td');
  avgStreakCell.textContent = avgStreak;
  avgRow.appendChild(avgStreakCell);
  const avgCompletionCell = document.createElement('td');
  avgCompletionCell.textContent = filteredHabits.length > 0 ? `${avgCompletion}%` : 'N/A';
  avgRow.appendChild(avgCompletionCell);
  const avgLastCompletedCell = document.createElement('td');
  avgLastCompletedCell.textContent = avgLastCompletedText;
  avgRow.appendChild(avgLastCompletedCell);
  
  tableBodyEl.appendChild(avgRow);

  tableHeaders.forEach(header => {
    const field = header.getAttribute('data-sort');
    const iconSpan = header.querySelector('.sort-icon');
    if (field === state.sortField) {
      iconSpan.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
    } else {
      iconSpan.textContent = '⇅';
    }
  });
}

// Initialize the app on load
loadData();
renderHabits();
