# Timely Tab: Student Planner & Organizer

A Chrome extension built with TypeScript that helps students manage their timetables, events, and tasks with an intuitive interface.

## Features

- **Interactive Timetable**: Drag-and-drop weekly timetable editor
- **Event Management**: Add, edit, and track upcoming events with notifications
- **Task Management**: Create and manage to-do lists
- **Theme Customization**: Multiple themes with custom color support
- **ICS Import**: Import calendar files from other applications
- **Notifications**: Automatic reminders for events and classes
- **Multi-week Navigation**: Plan and view multiple weeks
- **Responsive Design**: Works on various screen sizes

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Chrome browser for testing

### Installation

1. Clone or extract the project files
2. Install dependencies:
   ```bash
   cd timely_tab
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

### Available Scripts

- `npm run build` - Build for production (minified)
- `npm run dev` - Build for development with watch mode
- `npm run clean` - Remove dist folder
- `npm run type-check` - Type check without emitting files

## Loading the Extension

1. Build the project using `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `dist/` folder
5. The extension should now appear in your browser toolbar

## Technical Details

The extension is built with a modular TypeScript architecture:

- **Type Safety**: Comprehensive type definitions for all data structures
- **Class-based Design**: Organized code using ES6 classes
- **Async/Await**: Modern JavaScript patterns for Chrome API interactions
- **Storage Abstraction**: Wrapper classes for Chrome storage APIs
- **Error Handling**: Robust error handling throughout the application