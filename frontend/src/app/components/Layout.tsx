import { Outlet, Link, useLocation } from 'react-router';
import { Brain, LayoutDashboard, Target, Smile, Gamepad2, Lightbulb, BarChart3, Moon, Sun, Menu, X, PlugZap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { shouldShowGames, shouldShowSuggestions } = useData();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/habits', icon: Target, label: 'Habits' },
    { path: '/mood', icon: Smile, label: 'Mood' },
    { path: '/games', icon: Gamepad2, label: 'Games', highlight: shouldShowGames() },
    { path: '/suggestions', icon: Lightbulb, label: 'Suggestions', highlight: shouldShowSuggestions() },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: 'vscode:extension/thinkflow.thinkflow-vscode-link', icon: PlugZap, label: 'Extension', external: true },
  ];

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#800020] to-[#DCAE96] flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-[#800020] to-[#DCAE96] bg-clip-text text-transparent">
                ThinkFlow
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                    item.external ? (
                      <a
                        key={item.path}
                        href={item.path}
                        className="relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </a>
                    ) : (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                          ${isActive 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }
                        `}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.highlight && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#e63946] rounded-full animate-pulse" />
                        )}
                      </Link>
                    )
                );
              })}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border overflow-hidden"
            >
              <nav className="container mx-auto px-4 py-4 space-y-2">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    item.external ? (
                      <a
                        key={item.path}
                        href={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className="relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </a>
                    ) : (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`
                          relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                          ${isActive 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                        {item.highlight && (
                          <span className="absolute right-4 w-2 h-2 bg-[#e63946] rounded-full animate-pulse" />
                        )}
                      </Link>
                    )
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main className="min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
    </div>
  );
}
