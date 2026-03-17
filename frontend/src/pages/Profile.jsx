import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  UserCircleIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

const Profile = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Mock data - replace with real user data
  const profileData = {
    name: user?.name || 'John Smith',
    email: user?.email || 'john.smith@school.com',
    role: user?.role || 'Administrator',
    phone: '+1 (555) 123-4567',
    address: '123 Education Ave, Learning City, ST 12345',
    joinDate: 'January 15, 2024',
    department: 'Administration',
    bio: 'Passionate educator with over 10 years of experience in educational technology and school administration.',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">My Profile</h1>
        <Button variant="primary" size="sm">
          <PencilIcon className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <div className="text-center">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="inline-block"
            >
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 mx-auto flex items-center justify-center text-white font-bold text-4xl shadow-lg">
                {profileData.name.charAt(0)}
              </div>
            </motion.div>

            <h2 className="mt-4 text-xl font-semibold text-surface-900 dark:text-white">
              {profileData.name}
            </h2>
            <p className="text-primary-600 dark:text-primary-400 font-medium">
              {profileData.role}
            </p>
            <p className="text-sm text-surface-500 dark:text-gray-400 mt-1">
              {profileData.department}
            </p>

            {/* Status indicator */}
            <div className="mt-4 flex items-center justify-center">
              <span className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="ml-2 text-sm text-surface-600 dark:text-gray-400">Active</span>
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-surface-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">24</p>
              <p className="text-xs text-surface-600 dark:text-gray-400">Classes</p>
            </div>
            <div className="text-center p-3 bg-surface-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">156</p>
              <p className="text-xs text-surface-600 dark:text-gray-400">Students</p>
            </div>
          </div>
        </Card>

        {/* Details Card */}
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Personal Information
          </h3>

          <div className="space-y-4">
            {/* Email */}
            <div className="flex items-start space-x-3">
              <EnvelopeIcon className="w-5 h-5 text-surface-400 dark:text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-surface-500 dark:text-gray-400">Email Address</p>
                <p className="text-surface-900 dark:text-white">{profileData.email}</p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start space-x-3">
              <PhoneIcon className="w-5 h-5 text-surface-400 dark:text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-surface-500 dark:text-gray-400">Phone Number</p>
                <p className="text-surface-900 dark:text-white">{profileData.phone}</p>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start space-x-3">
              <MapPinIcon className="w-5 h-5 text-surface-400 dark:text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-surface-500 dark:text-gray-400">Address</p>
                <p className="text-surface-900 dark:text-white">{profileData.address}</p>
              </div>
            </div>

            {/* Join Date */}
            <div className="flex items-start space-x-3">
              <CalendarIcon className="w-5 h-5 text-surface-400 dark:text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-surface-500 dark:text-gray-400">Member Since</p>
                <p className="text-surface-900 dark:text-white">{profileData.joinDate}</p>
              </div>
            </div>

            {/* Bio */}
            <div className="flex items-start space-x-3">
              <UserCircleIcon className="w-5 h-5 text-surface-400 dark:text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-surface-500 dark:text-gray-400">Bio</p>
                <p className="text-surface-900 dark:text-white">{profileData.bio}</p>
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div className="mt-6 pt-6 border-t border-surface-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                  <p className="text-surface-600 dark:text-gray-400">Updated class schedule</p>
                  <p className="text-surface-400 dark:text-gray-600 text-xs">2 hours ago</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Profile;