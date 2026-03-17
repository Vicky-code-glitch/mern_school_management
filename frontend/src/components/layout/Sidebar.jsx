import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HomeIcon,
  UsersIcon,
  BookOpenIcon,
  AcademicCapIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  MegaphoneIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Users', href: '/users', icon: UsersIcon },
  { name: 'Classes', href: '/classes', icon: BookOpenIcon },
  { name: 'Subjects', href: '/subjects', icon: AcademicCapIcon },
  { name: 'Schedule', href: '/schedule', icon: CalendarIcon },
  { name: 'Assignments', href: '/assignments', icon: ClipboardDocumentListIcon },
  { name: 'Announcements', href: '/announcements', icon: MegaphoneIcon },
];

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const goToProfile = () => {
    navigate('/profile');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black lg:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ type: 'spring', damping: 25 }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-white dark:bg-gray-900 border-r border-surface-200 dark:border-gray-800 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-surface-200 dark:border-gray-800">
          <div className="flex items-center space-x-2 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-bold text-xl text-surface-900 dark:text-white"
              >
                EduFlow
              </motion.span>
            )}
          </div>
          
          {/* Collapse button - desktop only */}
          <button
            onClick={toggleCollapse}
            className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-gray-800 transition-colors hidden lg:block"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="size-4 text-surface-500 dark:text-gray-400" />
            ) : (
              <ChevronLeftIcon className="size-4 text-surface-500 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `
                flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg
                transition-all duration-200 group relative
                ${isActive 
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                  : 'text-surface-600 dark:text-gray-400 hover:bg-surface-50 dark:hover:bg-gray-800 hover:text-surface-900 dark:hover:text-gray-200'
                }
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="font-medium whitespace-nowrap">{item.name}</span>
              )}
              {isCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  {item.name}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Section - Settings and User Profile */}
        <div className="border-t border-surface-200 dark:border-gray-800 p-4 space-y-2">
          {/* Settings Link */}
          {bottomNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `
                flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg
                transition-all duration-200 group relative
                ${isActive 
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                  : 'text-surface-600 dark:text-gray-400 hover:bg-surface-50 dark:hover:bg-gray-800 hover:text-surface-900 dark:hover:text-gray-200'
                }
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="font-medium whitespace-nowrap">{item.name}</span>
              )}
              {isCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  {item.name}
                </span>
              )}
            </NavLink>
          ))}

          {/* User Profile Section - Clickable to profile */}
          <button
            onClick={goToProfile}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg bg-surface-50 dark:bg-gray-800/50 hover:bg-surface-100 dark:hover:bg-gray-800 transition-colors group relative`}
          >
            {/* Avatar with status */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
            </div>

            {/* User Info - only show when expanded */}
            {!isCollapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                  {user?.name || 'Admin User'}
                </p>
                <p className="text-xs text-surface-500 dark:text-gray-400 truncate">
                  {user?.role || 'Administrator'}
                </p>
              </div>
            )}

            {/* Logout button - separate click target */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className={`p-1.5 rounded-lg text-surface-500 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 transition-colors ${
                isCollapsed ? '' : 'ml-auto'
              }`}
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="size-4" />
            </div>

            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Profile
              </span>
            )}
          </button>

          {/* Version info - only when expanded */}
          {!isCollapsed && (
            <p className="text-xs text-center text-surface-400 dark:text-gray-600 mt-2">
              v2.0.0 • © 2024 EduFlow
            </p>
          )}
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;