
import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Buy groceries', completed: false, priority: 'Medium' },
    { id: 2, text: 'Walk the dog', completed: true, priority: 'Low' },
    { id: 3, text: 'Read a book', completed: false, priority: 'High' },
  ]);
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');
  const [isLoading, setIsLoading] = useState(true);

  // State for Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Simulate Lazy Loading
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  }, []);

  const addTask = () => {
    if (newTask.trim() === '') return;
    setTasks([
      ...tasks,
      { 
        id: Date.now(), 
        text: newTask, 
        completed: false, 
        priority: newPriority 
      }
    ]);
    setNewTask('');
    setNewPriority('Medium'); // Reset priority to default
  };

  const toggleTask = (id) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const initiateDelete = (id, e) => {
    e.stopPropagation();
    setTaskToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setTasks(tasks.filter((task) => task.id !== taskToDelete));
    setShowDeleteModal(false);
    setTaskToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setTaskToDelete(null);
  };

  return (
    <div className="app-wrapper">
      <div className="app-container">
        <header>
          <h1>Tasks</h1>
          <p className="subtitle">{tasks.filter(t => !t.completed).length} remaining</p>
        </header>
        
        <div className="input-group">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="What needs to be done?"
            onKeyPress={(e) => e.key === 'Enter' && addTask()}
          />
          <select 
            className="priority-select"
            value={newPriority} 
            onChange={(e) => setNewPriority(e.target.value)}
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <button 
            className="icon-btn add-btn" 
            onClick={addTask}
            data-tooltip="Add Task"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>

        <div className="task-list-container">
          {isLoading ? (
            <div className="skeleton-container">
              <div className="skeleton-item"></div>
              <div className="skeleton-item"></div>
              <div className="skeleton-item"></div>
            </div>
          ) : (
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                  <div className="task-content" onClick={() => toggleTask(task.id)}>
                    <div className="checkbox-custom">
                      {task.completed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </div>
                    <div className="text-wrapper">
                      <span>{task.text}</span>
                      <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                  <button 
                    className="icon-btn delete-btn" 
                    onClick={(e) => initiateDelete(task.id, e)}
                    data-tooltip="Delete Task"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </li>
              ))}
              {tasks.length === 0 && <li className="empty-state">No tasks yet. Add one above!</li>}
            </ul>
          )}
        </div>

        {/* Modern Modal */}
        {showDeleteModal && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Confirm Deletion</h3>
              </div>
              <p>Are you sure? This action cannot be undone.</p>
              <div className="modal-actions">
                <button className="btn-text" onClick={cancelDelete}>Cancel</button>
                <button className="btn-danger" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
