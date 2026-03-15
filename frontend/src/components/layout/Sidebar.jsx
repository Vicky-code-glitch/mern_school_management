import React from 'react';
import { NavLink } from 'react-router-dom';
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
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Users', href: '/users', icon: UsersIcon },
  { name: 'Classes', href: '/classes', icon: BookOpenIcon },
  { name: 'Subjects', href: '/subjects', icon: AcademicCapIcon },
  { name: 'Schedule', href: '/schedule', icon: CalendarIcon },
  { name: 'Assignments', href: '/assignments', icon: ClipboardDocumentListIcon },
  { name: 'Announcements', href: '/announcements', icon: MegaphoneIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

const Sidebar = ({ isOpen, setIsOpen }) => {
  return (
    <motion.aside
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: 'spring', damping: 20 }}
      className="fixed inset-y-0 left-0 w-64 bg-white border-r border-surface-200 shadow-sm z-30"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-surface-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">E</span>
          </div>
          <span className="font-bold text-xl text-surface-900">EduFlow</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) => `
              flex items-center space-x-3 px-4 py-3 rounded-lg
              transition-all duration-200
              ${isActive 
                ? 'bg-primary-50 text-primary-600' 
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
              }
            `}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Profile */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold">
            U
          </div>
          <div>
            <p className="font-medium text-surface-900">Admin User</p>
            <p className="text-sm text-surface-500">admin@school.com</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;