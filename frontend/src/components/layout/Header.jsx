import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  BellIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Mock notifications - replace with real data
  const notifications = [
    { id: 1, title: 'New assignment posted: Math Homework', time: '5 min ago', read: false },
    { id: 2, title: 'Parent-teacher meeting scheduled', time: '1 hour ago', read: false },
    { id: 3, title: 'Grade published for Science exam', time: '2 hours ago', read: true },
    { id: 4, title: 'School event: Sports Day', time: '1 day ago', read: true },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  // Get theme icon based on current mode
  const getThemeIcon = () => {
    if (theme === 'system') {
      return <ComputerDesktopIcon className="w-5 h-5" />;
    }
    return isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />;
  };

  // Get theme tooltip text
  const getThemeTooltip = () => {
    if (theme === 'system') return 'System theme';
    return isDark ? 'Switch to light mode' : 'Switch to dark mode';
  };

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-surface-200 dark:border-gray-800">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg text-surface-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-gray-800 hover:text-surface-900 dark:hover:text-gray-200 transition-colors"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? (
                <XMarkIcon className="w-5 h-5" />
              ) : (
                <Bars3Icon className="w-5 h-5" />
              )}
            </button>

            {/* Desktop Search */}
            <div className="hidden md:block relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search classes, assignments, people..."
                className="pl-9 pr-4 py-2 w-80 rounded-lg border border-surface-200 dark:border-gray-700 bg-surface-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all text-surface-900 dark:text-gray-100 placeholder-surface-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Mobile search button */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="md:hidden p-2 rounded-lg text-surface-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-gray-800 hover:text-surface-900 dark:hover:text-gray-200 transition-colors"
              aria-label="Search"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Right section - Clean and minimal */}
          <div className="flex items-center gap-2">
            {/* Theme toggle with tooltip */}
            <div className="relative group">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-surface-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-gray-800 hover:text-surface-900 dark:hover:text-gray-200 transition-colors"
                aria-label="Toggle theme"
              >
                {getThemeIcon()}
              </button>
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {getThemeTooltip()}
              </span>
            </div>

            {/* Notifications */}
            <div className="relative group">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-lg text-surface-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-gray-800 hover:text-surface-900 dark:hover:text-gray-200 transition-colors relative"
                aria-label="Notifications"
              >
                <BellIcon className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
                )}
              </button>

              {/* Notifications dropdown */}
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-surface-200 dark:border-gray-800 overflow-hidden z-50"
                  >
                    <div className="p-3 border-b border-surface-200 dark:border-gray-800">
                      <h3 className="font-semibold text-surface-900 dark:text-white">Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-3 hover:bg-surface-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                              !notification.read ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-surface-900 dark:text-white">
                              {notification.title}
                            </p>
                            <p className="text-xs text-surface-500 dark:text-gray-400 mt-1">
                              {notification.time}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-surface-500 dark:text-gray-400">
                          No notifications
                        </div>
                      )}
                    </div>
                    <div className="p-2 border-t border-surface-200 dark:border-gray-800">
                      <button className="w-full text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium py-1 transition-colors">
                        View all
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden py-3"
            >
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-surface-200 dark:border-gray-700 bg-surface-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all text-surface-900 dark:text-gray-100"
                  autoFocus
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;