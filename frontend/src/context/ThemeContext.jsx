import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    // Check system preference
    const getSystemTheme = () => {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    };

    // Get saved theme or system theme
    const getInitialTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
            return savedTheme;
        }
        return 'system';
    };

    const [theme, setTheme] = useState(getInitialTheme);
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
        const handleChange = (e) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement;
        const appliedTheme = theme === 'system' ? systemTheme : theme;
    
        root.classList.remove('light', 'dark');
        root.classList.add(appliedTheme);
    
        // Set color scheme meta for browser
        document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', appliedTheme);
    
        // Save preference
        localStorage.setItem('theme', theme);
    }, [theme, systemTheme]);

    const toggleTheme = () => {
        if (theme === 'light') setTheme('dark');
        else if (theme === 'dark') setTheme('system');
        else setTheme('light');
    };

    const value = {
        theme,
        setTheme,
        systemTheme,
        isDark: theme === 'system' ? systemTheme === 'dark' : theme === 'dark',
        toggleTheme,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};