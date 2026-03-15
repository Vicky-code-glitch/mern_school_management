import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  // Map paths to display names
  const pathMap = {
    'dashboard': 'Dashboard',
    'users': 'Users',
    'classes': 'Classes',
    'subjects': 'Subjects',
    'schedule': 'Schedule',
    'assignments': 'Assignments',
    'announcements': 'Announcements',
    'settings': 'Settings',
  };

  return (
    <nav className="flex items-center space-x-2 text-sm mb-6">
      <Link
        to="/"
        className="flex items-center text-surface-500 hover:text-primary-600 transition-colors"
      >
        <HomeIcon className="w-4 h-4" />
      </Link>

      {pathnames.length > 0 && (
        <ChevronRightIcon className="w-4 h-4 text-surface-400" />
      )}

      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;

        return (
          <React.Fragment key={name}>
            {isLast ? (
              <span className="text-surface-900 font-medium">
                {pathMap[name] || name}
              </span>
            ) : (
              <>
                <Link
                  to={routeTo}
                  className="text-surface-500 hover:text-primary-600 transition-colors"
                >
                  {pathMap[name] || name}
                </Link>
                <ChevronRightIcon className="w-4 h-4 text-surface-400" />
              </>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;